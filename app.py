"""
SARF Port — SarfOS Digital Twin Backend
نظام التشغيل الصرفي لإدارة الميناء الذاتي
"""
import re, time, uuid
from datetime import datetime
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# ── CORS ────────────────────────────────────────────────────
@app.after_request
def cors(r):
    r.headers["Access-Control-Allow-Origin"]  = "*"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type"
    r.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return r

# ═══════════════════════════════════════════════════════════
#  خريطة الميناء — SARF Port Map
# ═══════════════════════════════════════════════════════════
PORT_ZONES = {
    "BERTH_1":   {"name":"رصيف 1",           "x":120,  "z":-80,  "type":"berth",      "status":"IDLE"},
    "BERTH_2":   {"name":"رصيف 2",           "x":160,  "z":-30,  "type":"berth",      "status":"IDLE"},
    "CONTAINERS":{"name":"منطقة الحاويات",   "x":140,  "z": 40,  "type":"cargo",      "status":"ACTIVE"},
    "CUSTOMS":   {"name":"الجمارك",          "x": 80,  "z": 60,  "type":"admin",      "status":"IDLE"},
    "LOGISTICS": {"name":"اللوجستية",        "x": 50,  "z": 20,  "type":"logistics",  "status":"ACTIVE"},
    "WAREHOUSE": {"name":"المستودع",         "x": 30,  "z":-20,  "type":"storage",    "status":"IDLE"},
    "CHARGE_A":  {"name":"محطة شحن A",       "x":-60,  "z": 60,  "type":"charge",     "status":"ACTIVE"},
    "CHARGE_B":  {"name":"محطة شحن B",       "x":-80,  "z":-20,  "type":"charge",     "status":"IDLE"},
    "CONTROL":   {"name":"مركز التحكم",      "x":  0,  "z":  0,  "type":"hub",        "status":"ACTIVE"},
    "GATE_N":    {"name":"البوابة الشمالية", "x":  0,  "z": 180, "type":"gate",       "status":"CLOSED"},
    "CRANE_1":   {"name":"رافعة 1",          "x":110,  "z":-90,  "type":"crane",      "status":"IDLE"},
    "CRANE_2":   {"name":"رافعة 2",          "x":155,  "z":-40,  "type":"crane",      "status":"IDLE"},
    "DRONE_HUB": {"name":"محطة الدرونز",    "x":-40,  "z":-60,  "type":"drone",      "status":"ACTIVE"},
}
CHARGE_ZONES = {"CHARGE_A","CHARGE_B","CONTROL"}

# ═══════════════════════════════════════════════════════════
#  SarfOS — محرك التحليل الصرفي الكامل
# ═══════════════════════════════════════════════════════════

# الأوزان الصرفية → syscall
WAZN_MAP = [
    (r'^(أَ|أر|أم|أق|أو)',   "sys_trigger",    "أَفْعَلَ",  4),
    (r'^(فَعَّ|جهّ|أمّ|فرّ)', "sys_intensify",  "فَعَّلَ",   5),
    (r'^(تَفَاع|تزام|تعاو)',  "sys_broadcast",  "تَفَاعَلَ", 6),
    (r'^(اِنْف|انقط|انكس)',   "sys_react",      "اِنْفَعَلَ",7),
    (r'^(اِفْت|اجته|اكتش)',   "sys_self",       "اِفْتَعَلَ",8),
    (r'^(اِسْت|استأ|استر)',   "sys_request",    "اِسْتَفْعَلَ",9),
]

# الأفعال → opcodes
VERB_OPCODES = [
    (r'أَرْسِ|أرسِ|أرسى|أوقف', "DOCK"),
    (r'أرسلْ|بثّ|أذعْ|وجّهْ',  "SEND"),
    (r'انطلقْ|تحرّكْ|توجّهْ',  "MOVE"),
    (r'أمّنْ|حصّنْ|احرسْ',    "SECURE"),
    (r'افحصْ|امسحْ|تفقّدْ',   "SCAN"),
    (r'جهّزْ|هيّئْ|استعدّ',   "PREPARE"),
    (r'اشحنْ',                  "CHARGE"),
    (r'سلّمْ|فرّغْ|أنزلْ',    "DELIVER"),
    (r'حرّرْ|أطلقْ',           "RELEASE"),
    (r'رسا|وصلَ|اكتملَ',      "COMPLETE"),
    (r'انقطعَ|انكسرَ|انهارَ', "EMERGENCY"),
    (r'أقلعْ|ارتفعْ',          "LAUNCH"),
]

# المناطق
ZONE_KEYS = [
    (r'رصيف\s*1|المرسى الأول',  "BERTH_1"),
    (r'رصيف\s*2|المرسى الثاني', "BERTH_2"),
    (r'الحاوي|حاويات',          "CONTAINERS"),
    (r'الجمارك|جمارك',          "CUSTOMS"),
    (r'اللوجستي|لوجستية',       "LOGISTICS"),
    (r'المستودع|مستودع',        "WAREHOUSE"),
    (r'شحن\s*A|CHARGE_A',       "CHARGE_A"),
    (r'شحن\s*B|CHARGE_B',       "CHARGE_B"),
    (r'المركز|مركز التحكم',     "CONTROL"),
    (r'البوابة|بوابة',          "GATE_N"),
    (r'رافعة\s*1|CRANE_1',      "CRANE_1"),
    (r'رافعة\s*2|CRANE_2',      "CRANE_2"),
    (r'درون|طائرة',             "DRONE_HUB"),
]

MOTLAQ   = ["تأميناً","تجهيزاً","فحصاً","إرساءً","مراقبةً","شحناً"]
INTENSE  = ["كاملاً","تاماً","شاملاً","دقيقاً","محكماً"]

def parse_sarf(sentence: str) -> dict:
    t0 = time.perf_counter()
    words = sentence.split()
    verb  = words[0] if words else ""

    # Wazn → syscall
    syscall, wazn, syscall_num = "sys_execute", "فَعَلَ", 1
    for pat, sc, wz, num in WAZN_MAP:
        if re.match(pat, verb):
            syscall, wazn, syscall_num = sc, wz, num
            break

    # Opcode
    opcode = None
    for pat, op in VERB_OPCODES:
        if re.search(pat, sentence):
            opcode = op; break

    # Zone
    zone = None
    for pat, z in ZONE_KEYS:
        if re.search(pat, sentence):
            zone = z; break

    # Vehicle type
    vehicle = "DRONE" if re.search(r'درون|طائرة', sentence) else \
              "CRANE" if re.search(r'رافعة',       sentence) else "VEHICLE"

    # Nahw controls
    controls, laws = [], []
    if re.search(r'\s+و\s+', sentence):
        controls.append("SEQUENTIAL"); laws.append("ن-1: واو = SEQUENTIAL")
    if re.search(r'\s+فـ|\s+فَ\s+', sentence):
        controls.append("IMMEDIATE");  laws.append("ن-2: فاء = IMMEDIATE")
    if 'ثم' in sentence:
        controls.append("DEFERRED");   laws.append("ن-3: ثم = DEFERRED")
    if re.search(r'إذا|فور|عند|متى', sentence):
        controls.append("TRIGGERED");  laws.append("ن-8: ظرف = EVENT_TRIGGER")
    if re.search(r'وهو|وهي|بينما', sentence):
        controls.append("PARALLEL");   laws.append("ن-6: الحال = PARALLEL")

    # Security (shell layer)
    security, blocked = None, False
    if 'لن' in sentence:
        security, blocked = "PERMANENT_BLOCK", True; laws.append("نفي: لن = حظر دائم")
    elif re.search(r'لا\s+ت', sentence):
        security, blocked = "RUNTIME_BLOCK", True;   laws.append("نفي: لا = حجب فوري")
    elif re.search(r'لم\s+ي', sentence):
        security = "AUDIT_LOG";                       laws.append("نفي: لم = سجل تدقيق")

    # Network (حروف الجر)
    packet = None
    if re.search(r'مِن.*إلى', sentence):
        src = re.search(r'مِن\s+(\S+)', sentence)
        dst = re.search(r'إلى\s+(\S+)', sentence)
        pay = re.search(r'بـ?\s*(\S+)',  sentence)
        packet = {
            "src":  src.group(1) if src else "UNKNOWN",
            "dst":  dst.group(1) if dst else "UNKNOWN",
            "data": pay.group(1) if pay else "NONE",
        }
        laws.append("ن-10: حروف الجر = بروتوكولات شبكة")

    # ISA intensity (قانون M)
    has_motlaq  = any(w in sentence for w in MOTLAQ)
    has_intense = any(w in sentence for w in INTENSE)
    if has_motlaq and has_intense:
        intensity = "ULTRA"; laws.append("M+: مفعول مطلق+شدة = ULTRA")
    elif has_motlaq:
        intensity = "HIGH";  laws.append("M: مفعول مطلق = HIGH")
    else:
        intensity = "NORMAL"

    # Emergency (قانون E)
    if opcode == "EMERGENCY":
        laws.append("E: اِنْفَعَلَ = طوارئ ذاتية")

    ms = round((time.perf_counter()-t0)*1000, 4)
    zone_info = PORT_ZONES.get(zone)

    return {
        "id":         str(uuid.uuid4())[:8],
        "sentence":   sentence,
        "verb":       verb,
        "wazn":       wazn,
        "syscall":    {"name": syscall, "num": syscall_num},
        "opcode":     opcode or "NOP",
        "zone":       zone,
        "zone_info":  zone_info,
        "vehicle":    vehicle,
        "controls":   controls,
        "security":   security,
        "blocked":    blocked,
        "intensity":  intensity,
        "packet":     packet,
        "laws":       laws,
        "parse_ms":   ms,
        "timestamp":  datetime.now().isoformat(),
    }

# ═══════════════════════════════════════════════════════════
#  Routes
# ═══════════════════════════════════════════════════════════
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/parse", methods=["POST","OPTIONS"])
def api_parse():
    if request.method == "OPTIONS": return "", 204
    data = request.get_json(silent=True) or {}
    s = data.get("sentence","").strip()
    if not s: return jsonify({"error":"الجملة فارغة"}), 400
    return jsonify(parse_sarf(s))

@app.route("/api/zones")
def api_zones():
    return jsonify(PORT_ZONES)

@app.route("/api/ping")
def api_ping():
    return jsonify({"status":"ok","engine":"SarfOS v2.0","port":"SARF Port"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)

