// Secret Skyrim MP - SkyrimVoice Mumble plugin
// Target: Mumble 1.5.x plugin API 1.2.x, Windows x64.
// Bridge: SkyrimPlatform -> HTTP 127.0.0.1:38471 -> this plugin.

#include "MumblePlugin.h"

#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <memory>
#include <iomanip>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#pragma comment(lib, "Ws2_32.lib")

namespace {
constexpr unsigned short kBridgePort = 38471;
constexpr long long kStateTimeoutMs = 1500;
constexpr long long kRouteTimeoutMs = 5000;
constexpr long long kTalkingHoldMs = 240;
constexpr long long kTalkerForgetMs = 2000;
constexpr float kSpeechFloor = 0.0035f;

mumble_api_t g_api{};
mumble_plugin_id_t g_pluginId = 0;
std::atomic<mumble_connection_t> g_connection{static_cast<mumble_connection_t>(-1)};
std::atomic<bool> g_running{false};
std::atomic<bool> g_ptt{false};
std::atomic<long long> g_lastStateMs{0};
std::atomic<long long> g_lastRouteMs{0};
std::atomic<bool> g_routeReady{false};
std::thread g_httpThread;

struct PositionState {
  bool valid = false;
  int profileId = -1;
  float pos[3]{0,0,0};
  float front[3]{0,0,1};
  float top[3]{0,1,0};
  std::string context = "secret-skyrim-mp";
};

std::mutex g_stateMutex;
PositionState g_state;
std::mutex g_routeMutex;
std::unordered_set<int> g_allowedProfiles;
std::shared_ptr<const std::unordered_set<mumble_userid_t>> g_allowedUsers =
  std::make_shared<const std::unordered_set<mumble_userid_t>>();
std::shared_ptr<const std::unordered_map<mumble_userid_t, int>> g_profileByUser =
  std::make_shared<const std::unordered_map<mumble_userid_t, int>>();

struct TalkerState {
  float level = 0.0f;
  long long lastSpeechMs = 0;
};

std::mutex g_talkerMutex;
std::unordered_map<int, TalkerState> g_remoteTalkers;
std::atomic<float> g_localLevel{0.0f};
std::atomic<long long> g_lastLocalSpeechMs{0};

long long nowMs() {
  return std::chrono::duration_cast<std::chrono::milliseconds>(
    std::chrono::steady_clock::now().time_since_epoch()).count();
}

MumbleStringWrapper wrapStatic(const char* s) {
  MumbleStringWrapper w{};
  w.data = s;
  w.size = std::strlen(s);
  w.needsReleasing = false;
  return w;
}

std::unordered_map<std::string,std::string> parseLines(const std::string& body) {
  std::unordered_map<std::string,std::string> out;
  std::istringstream in(body);
  std::string line;
  while (std::getline(in, line)) {
    if (!line.empty() && line.back() == '\r') line.pop_back();
    auto eq = line.find('=');
    if (eq == std::string::npos) continue;
    out[line.substr(0, eq)] = line.substr(eq + 1);
  }
  return out;
}

int asInt(const std::unordered_map<std::string,std::string>& m, const char* k, int fallback) {
  auto it = m.find(k); if (it == m.end()) return fallback;
  try { return std::stoi(it->second); } catch (...) { return fallback; }
}
float asFloat(const std::unordered_map<std::string,std::string>& m, const char* k, float fallback) {
  auto it = m.find(k); if (it == m.end()) return fallback;
  try { return std::stof(it->second); } catch (...) { return fallback; }
}

bool parseProfileName(const char* name, int& profileId) {
  if (!name) return false;
  std::string s(name);
  if (s.rfind("sk_", 0) != 0 || s.size() <= 3) return false;
  try {
    size_t used = 0;
    int value = std::stoi(s.substr(3), &used);
    if (used != s.size() - 3 || value < 0) return false;
    profileId = value;
    return true;
  } catch (...) { return false; }
}


float displayLevelFromRms(double rms) {
  const double shifted = std::max(0.0, rms - static_cast<double>(kSpeechFloor));
  return static_cast<float>(std::clamp(shifted * 14.0, 0.0, 1.0));
}

float levelFromFloatPcm(const float* pcm, size_t total) {
  if (!pcm || total == 0) return 0.0f;
  double sum = 0.0;
  for (size_t i = 0; i < total; ++i) {
    const double v = static_cast<double>(pcm[i]);
    sum += v * v;
  }
  return displayLevelFromRms(std::sqrt(sum / static_cast<double>(total)));
}

float levelFromInt16Pcm(const short* pcm, size_t total) {
  if (!pcm || total == 0) return 0.0f;
  double sum = 0.0;
  for (size_t i = 0; i < total; ++i) {
    const double v = static_cast<double>(pcm[i]) / 32768.0;
    sum += v * v;
  }
  return displayLevelFromRms(std::sqrt(sum / static_cast<double>(total)));
}

void noteRemoteSpeech(mumble_userid_t userID, float level) {
  if (level <= 0.0f) return;
  const auto profiles = std::atomic_load(&g_profileByUser);
  if (!profiles) return;
  const auto it = profiles->find(userID);
  if (it == profiles->end()) return;

  const long long now = nowMs();
  std::lock_guard<std::mutex> lock(g_talkerMutex);
  auto& state = g_remoteTalkers[it->second];
  const float previous = (now - state.lastSpeechMs <= kTalkingHoldMs) ? state.level : 0.0f;
  state.level = std::max(level, previous * 0.72f);
  state.lastSpeechMs = now;
}

std::string buildTalkersJson() {
  const long long now = nowMs();
  const bool ptt = g_ptt.load();
  const bool localTalking = ptt && (now - g_lastLocalSpeechMs.load() <= kTalkingHoldMs);
  const float localLevel = localTalking ? g_localLevel.load() : 0.0f;

  std::ostringstream out;
  out << "{\"status\":\"ok\",\"ptt\":" << (ptt ? "true" : "false")
      << ",\"localTalking\":" << (localTalking ? "true" : "false")
      << ",\"localLevel\":" << std::fixed << std::setprecision(3) << localLevel
      << ",\"talkers\":[";

  bool first = true;
  {
    std::lock_guard<std::mutex> lock(g_talkerMutex);
    for (auto it = g_remoteTalkers.begin(); it != g_remoteTalkers.end();) {
      const long long age = now - it->second.lastSpeechMs;
      if (age > kTalkerForgetMs) {
        it = g_remoteTalkers.erase(it);
        continue;
      }
      if (age <= kTalkingHoldMs) {
        if (!first) out << ',';
        first = false;
        out << "{\"profileId\":" << it->first
            << ",\"level\":" << std::fixed << std::setprecision(3) << it->second.level << '}';
      }
      ++it;
    }
  }
  out << "]}";
  return out.str();
}

void configureMumble() {
  if (!g_pluginId) return;
  g_api.requestLocalUserTransmissionMode(g_pluginId, MUMBLE_TM_PUSH_TO_TALK);
  g_api.setMumbleSetting_double(g_pluginId, MUMBLE_SK_AUDIO_OUTPUT_PA_MINIMUM_DISTANCE, 2.0);
  g_api.setMumbleSetting_double(g_pluginId, MUMBLE_SK_AUDIO_OUTPUT_PA_MAXIMUM_DISTANCE, 15.0);
  g_api.setMumbleSetting_double(g_pluginId, MUMBLE_SK_AUDIO_OUTPUT_PA_MINIMUM_VOLUME, 0.0);
  g_api.setMumbleSetting_double(g_pluginId, MUMBLE_SK_AUDIO_OUTPUT_PA_BLOOM, 0.5);
}

void applyPtt(bool pressed) {
  bool previous = g_ptt.exchange(pressed);
  if (previous == pressed || !g_pluginId) return;
  g_api.requestMicrophoneActivationOvewrite(g_pluginId, pressed);
}

void rebuildAllowedUsers() {
  const auto connection = g_connection.load();
  if (connection < 0 || !g_routeReady.load()) {
    std::atomic_store(&g_allowedUsers,
      std::make_shared<const std::unordered_set<mumble_userid_t>>());
    std::atomic_store(&g_profileByUser,
      std::make_shared<const std::unordered_map<mumble_userid_t, int>>());
    return;
  }

  std::unordered_set<int> allowedProfiles;
  {
    std::lock_guard<std::mutex> lock(g_routeMutex);
    allowedProfiles = g_allowedProfiles;
  }

  mumble_userid_t* users = nullptr;
  size_t count = 0;
  if (g_api.getAllUsers(g_pluginId, connection, &users, &count) != MUMBLE_STATUS_OK) return;

  auto result = std::make_shared<std::unordered_set<mumble_userid_t>>();
  auto profiles = std::make_shared<std::unordered_map<mumble_userid_t, int>>();
  for (size_t i = 0; i < count; ++i) {
    const char* name = nullptr;
    if (g_api.getUserName(g_pluginId, connection, users[i], &name) != MUMBLE_STATUS_OK) continue;
    int profile = -1;
    if (parseProfileName(name, profile)) {
      (*profiles)[users[i]] = profile;
      if (allowedProfiles.count(profile)) result->insert(users[i]);
    }
    g_api.freeMemory(g_pluginId, name);
  }
  g_api.freeMemory(g_pluginId, users);
  std::atomic_store(&g_allowedUsers,
    std::static_pointer_cast<const std::unordered_set<mumble_userid_t>>(result));
  std::atomic_store(&g_profileByUser,
    std::static_pointer_cast<const std::unordered_map<mumble_userid_t, int>>(profiles));
}

void handleState(const std::unordered_map<std::string,std::string>& v) {
  PositionState next;
  next.valid = true;
  next.profileId = asInt(v, "profileId", -1);
  next.pos[0] = asFloat(v, "x", 0); next.pos[1] = asFloat(v, "y", 0); next.pos[2] = asFloat(v, "z", 0);
  next.front[0] = asFloat(v, "frontX", 0); next.front[1] = asFloat(v, "frontY", 0); next.front[2] = asFloat(v, "frontZ", 1);
  next.top[0] = asFloat(v, "topX", 0); next.top[1] = asFloat(v, "topY", 1); next.top[2] = asFloat(v, "topZ", 0);
  auto it = v.find("context");
  if (it != v.end() && !it->second.empty()) next.context = it->second.substr(0, 120);
  {
    std::lock_guard<std::mutex> lock(g_stateMutex);
    g_state = std::move(next);
  }
  g_lastStateMs.store(nowMs());
}

void handleRoute(const std::unordered_map<std::string,std::string>& v) {
  const int routeProfile = asInt(v, "profileId", -1);
  {
    std::lock_guard<std::mutex> stateLock(g_stateMutex);
    if (g_state.profileId >= 0 && routeProfile >= 0 && routeProfile != g_state.profileId) return;
  }
  std::unordered_set<int> route;
  auto it = v.find("audible");
  if (it != v.end() && !it->second.empty()) {
    std::istringstream ss(it->second);
    std::string item;
    while (std::getline(ss, item, ',')) {
      try { int n = std::stoi(item); if (n >= 0) route.insert(n); } catch (...) {}
    }
  }
  {
    std::lock_guard<std::mutex> lock(g_routeMutex);
    g_allowedProfiles = route;
  }
  {
    std::lock_guard<std::mutex> lock(g_talkerMutex);
    for (auto itTalker = g_remoteTalkers.begin(); itTalker != g_remoteTalkers.end();) {
      if (!route.count(itTalker->first)) itTalker = g_remoteTalkers.erase(itTalker);
      else ++itTalker;
    }
  }
  g_routeReady.store(true);
  g_lastRouteMs.store(nowMs());
  rebuildAllowedUsers();
}

void sendResponse(SOCKET client, int status, const char* type, const std::string& body) {
  std::ostringstream out;
  out << "HTTP/1.1 " << status << (status == 200 ? " OK" : " Bad Request") << "\r\n"
      << "Content-Type: " << type << "\r\n"
      << "Content-Length: " << body.size() << "\r\n"
      << "Connection: close\r\n\r\n" << body;
  const std::string data = out.str();
  send(client, data.data(), static_cast<int>(data.size()), 0);
}

void handleHttpClient(SOCKET client) {
  std::string request;
  char buf[4096];
  int expected = -1;
  for (;;) {
    int n = recv(client, buf, sizeof(buf), 0);
    if (n <= 0) break;
    request.append(buf, buf + n);
    auto split = request.find("\r\n\r\n");
    if (split != std::string::npos) {
      if (expected < 0) {
        expected = 0;
        std::string headers = request.substr(0, split);
        auto p = headers.find("Content-Length:");
        if (p != std::string::npos) {
          p += 15;
          try { expected = std::stoi(headers.substr(p)); } catch (...) { expected = 0; }
        }
      }
      if (request.size() >= split + 4 + static_cast<size_t>(expected)) break;
    }
    if (request.size() > 65536) break;
  }

  const auto headerEnd = request.find("\r\n\r\n");
  if (headerEnd == std::string::npos) { sendResponse(client, 400, "text/plain", "bad request"); return; }
  const auto firstEnd = request.find("\r\n");
  const std::string first = request.substr(0, firstEnd);
  const std::string body = request.substr(headerEnd + 4);

  if (first.rfind("GET /health ", 0) == 0) {
    const bool fresh = nowMs() - g_lastStateMs.load() <= kStateTimeoutMs;
    sendResponse(client, 200, "application/json", fresh
      ? "{\"status\":\"ok\",\"game\":true}"
      : "{\"status\":\"ok\",\"game\":false}");
    return;
  }
  if (first.rfind("GET /talkers ", 0) == 0) {
    sendResponse(client, 200, "application/json", buildTalkersJson());
    return;
  }
  const auto values = parseLines(body);
  if (first.rfind("POST /state ", 0) == 0) {
    handleState(values); sendResponse(client, 200, "text/plain", "ok"); return;
  }
  if (first.rfind("POST /route ", 0) == 0) {
    handleRoute(values); sendResponse(client, 200, "text/plain", "ok"); return;
  }
  if (first.rfind("POST /ptt ", 0) == 0) {
    applyPtt(asInt(values, "pressed", 0) != 0); sendResponse(client, 200, "text/plain", "ok"); return;
  }
  sendResponse(client, 400, "text/plain", "unknown endpoint");
}

void httpLoop() {
  WSADATA data{};
  if (WSAStartup(MAKEWORD(2,2), &data) != 0) return;
  SOCKET server = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (server == INVALID_SOCKET) { WSACleanup(); return; }
  BOOL exclusive = TRUE;
  setsockopt(server, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, reinterpret_cast<const char*>(&exclusive), sizeof(exclusive));
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(kBridgePort);
  inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);
  if (bind(server, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) == SOCKET_ERROR ||
      listen(server, 8) == SOCKET_ERROR) {
    closesocket(server); WSACleanup(); return;
  }

  while (g_running.load()) {
    fd_set set; FD_ZERO(&set); FD_SET(server, &set);
    timeval tv{}; tv.tv_sec = 0; tv.tv_usec = 200000;
    int ready = select(0, &set, nullptr, nullptr, &tv);
    if (ready > 0 && FD_ISSET(server, &set)) {
      SOCKET client = accept(server, nullptr, nullptr);
      if (client != INVALID_SOCKET) { handleHttpClient(client); shutdown(client, SD_BOTH); closesocket(client); }
    }
    const long long now = nowMs();
    if (g_ptt.load() && now - g_lastStateMs.load() > kStateTimeoutMs) applyPtt(false);
    if (g_routeReady.load() && now - g_lastRouteMs.load() > kRouteTimeoutMs) {
      g_routeReady.store(false);
      std::atomic_store(&g_allowedUsers,
        std::make_shared<const std::unordered_set<mumble_userid_t>>());
      std::atomic_store(&g_profileByUser,
        std::make_shared<const std::unordered_map<mumble_userid_t, int>>());
      {
        std::lock_guard<std::mutex> lock(g_talkerMutex);
        g_remoteTalkers.clear();
      }
    }
  }
  closesocket(server);
  WSACleanup();
}
} // namespace

mumble_error_t mumble_init(uint32_t id) {
  g_pluginId = id;
  g_running.store(true);
  configureMumble();
  g_httpThread = std::thread(httpLoop);
  g_api.log(g_pluginId, "SkyrimVoice 0.2.0 initialized on 127.0.0.1:38471 (talking meter enabled)");
  return MUMBLE_STATUS_OK;
}

void mumble_shutdown() {
  applyPtt(false);
  g_running.store(false);
  if (g_httpThread.joinable()) g_httpThread.join();
  g_localLevel.store(0.0f);
  g_lastLocalSpeechMs.store(0);
  {
    std::lock_guard<std::mutex> lock(g_talkerMutex);
    g_remoteTalkers.clear();
  }
  g_pluginId = 0;
}

MumbleStringWrapper mumble_getName() { return wrapStatic("SkyrimVoice"); }
mumble_version_t mumble_getAPIVersion() { return MUMBLE_PLUGIN_API_VERSION; }
void mumble_registerAPIFunctions(void* api) { g_api = MUMBLE_API_CAST(api); }
void mumble_releaseResource(const void* pointer) { (void)pointer; }

mumble_version_t mumble_getVersion() { return {0, 2, 0}; }
MumbleStringWrapper mumble_getAuthor() { return wrapStatic("Secret Skyrim MP"); }
MumbleStringWrapper mumble_getDescription() { return wrapStatic("Skyrim proximity voice bridge for Secret Skyrim MP"); }
uint32_t mumble_getFeatures() { return MUMBLE_FEATURE_POSITIONAL | MUMBLE_FEATURE_AUDIO; }
uint32_t mumble_deactivateFeatures(uint32_t features) { return features & ~(MUMBLE_FEATURE_POSITIONAL | MUMBLE_FEATURE_AUDIO); }

uint8_t mumble_initPositionalData(const char* const*, const uint64_t*, size_t) {
  if (nowMs() - g_lastStateMs.load() > kStateTimeoutMs) return MUMBLE_PDEC_ERROR_TEMP;
  return MUMBLE_PDEC_OK;
}

bool mumble_fetchPositionalData(float* avatarPos, float* avatarDir, float* avatarAxis,
                                float* cameraPos, float* cameraDir, float* cameraAxis,
                                const char** context, const char** identity) {
  if (nowMs() - g_lastStateMs.load() > kStateTimeoutMs) return false;
  PositionState state;
  {
    std::lock_guard<std::mutex> lock(g_stateMutex);
    state = g_state;
  }
  if (!state.valid) return false;
  for (int i=0;i<3;i++) {
    avatarPos[i]=state.pos[i]; avatarDir[i]=state.front[i]; avatarAxis[i]=state.top[i];
    cameraPos[i]=state.pos[i]; cameraDir[i]=state.front[i]; cameraAxis[i]=state.top[i];
  }
  thread_local std::string ctx;
  thread_local std::string ident;
  ctx = state.context;
  ident = state.profileId >= 0 ? ("sk_" + std::to_string(state.profileId)) : "sk_unknown";
  *context = ctx.c_str();
  *identity = ident.c_str();
  return true;
}
void mumble_shutdownPositionalData() {}
MumbleStringWrapper mumble_getPositionalDataContextPrefix() { return wrapStatic("secret-skyrim"); }

void mumble_onServerConnected(mumble_connection_t connection) { g_connection.store(connection); }
void mumble_onServerDisconnected(mumble_connection_t) {
  g_connection.store(static_cast<mumble_connection_t>(-1));
  g_routeReady.store(false);
  applyPtt(false);
  g_localLevel.store(0.0f);
  g_lastLocalSpeechMs.store(0);
  std::atomic_store(&g_allowedUsers, std::make_shared<const std::unordered_set<mumble_userid_t>>());
  std::atomic_store(&g_profileByUser, std::make_shared<const std::unordered_map<mumble_userid_t, int>>());
  {
    std::lock_guard<std::mutex> lock(g_talkerMutex);
    g_remoteTalkers.clear();
  }
}
void mumble_onServerSynchronized(mumble_connection_t connection) {
  g_connection.store(connection);
  configureMumble();
  rebuildAllowedUsers();
}
void mumble_onUserAdded(mumble_connection_t, mumble_userid_t) { rebuildAllowedUsers(); }
void mumble_onUserRemoved(mumble_connection_t, mumble_userid_t) { rebuildAllowedUsers(); }

bool mumble_onAudioInput(short* inputPCM, uint32_t sampleCount, uint16_t channelCount,
                         uint32_t, bool isSpeech) {
  if (!inputPCM || !isSpeech || !g_ptt.load()) return false;
  const size_t total = static_cast<size_t>(sampleCount) * channelCount;
  const float level = levelFromInt16Pcm(inputPCM, total);
  if (level > 0.0f) {
    const long long now = nowMs();
    const float previous = (now - g_lastLocalSpeechMs.load() <= kTalkingHoldMs) ? g_localLevel.load() : 0.0f;
    g_localLevel.store(std::max(level, previous * 0.72f));
    g_lastLocalSpeechMs.store(now);
  }
  return false;
}

bool mumble_onAudioSourceFetched(float* pcm, uint32_t sampleCount, uint16_t channelCount,
                                 uint32_t, bool isSpeech, mumble_userid_t userID) {
  if (!isSpeech || !pcm) return false;
  const auto allowed = std::atomic_load(&g_allowedUsers);
  const bool permit = g_routeReady.load() && allowed && allowed->find(userID) != allowed->end();
  const size_t total = static_cast<size_t>(sampleCount) * channelCount;
  if (permit) {
    noteRemoteSpeech(userID, levelFromFloatPcm(pcm, total));
    return false;
  }
  std::fill(pcm, pcm + total, 0.0f);
  return true;
}
