"""
OXAGON Digital Twin — Sarf ISA Backend
نظام صَرْف ISA لمدينة أوكساجون
"""
import re, time, uuid
from datetime import datetime
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# ── CORS manual (no flask-cors needed) ──────────────────────
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response

# ═══════════════════════════════════════════════════════════
#  خريطة أوكساجون — Oxagon Zone Registry
# ═══════════════════════════════════════════════════════════
OXAGON_ZONES = {
    "ميناء":             {"id":"PORT",        "x": 120,  "z":-80,  "type":"port",        "label":"ميناء أوكساجون"},
    "الميناء":           {"id":"PORT",        "x": 120,  "z":-80,  "type":"port",        "label":"ميناء أوكساجون"},
    "المنطقة اللوجستية":{"id":"LOGISTICS",   "x":  60,  "z": 20,  "type":"logistics",   "label":"المنطقة اللوجستية"},
    "مستودع":            {"id":"WAREHOUSE",   "x":  80,  "z": 60,  "type":"logistics",   "label":"مستودع المواد"},
    "الحاويات":          {"id":"CONTAINERS",  "x": 140,  "z":-40,  "type":"port",        "label":"منطقة الحاويات"},
    "المصنع":            {"id":"FACTORY",     "x": -60,  "z":-60,  "type":"industry",    "label":"المصنع الرئيسي"},
    "الطاقة":            {"id":"ENERGY",      "x":-120,  "z": 20,  "type":"energy",      "label":"محطة الطاقة"},
    "محطة الشحن":        {"id":"CHARGE",      "x": -80,  "z": 80,  "type":"energy",      "label":"محطة الشحن"},
    "السكن":             {"id":"RESIDENTIAL", "x":  20,  "z":100,  "type":"residential", "label":"الحي السكني"},
    "المركز":            {"id":"CENTER",      "x":   0,  "z":  0,  "type":"hub",         "label":"مركز أوكساجون"},
    "المطار":            {"id":"AIRPORT",     "x":-140,  "z":-80,  "type":"airport",     "label":"مطار أوكساجون"},
}

# ═══════════════════════════════════════════════════════════
#  محرك صَرْف ISA
# ═══════════════════════════════════════════════════════════
VERB_MAP = {
    r'انطلق|توجّه|توجه|اذهب|انتقل': {"opcode":"MOVE",    "wazn":"فعل أمر — اِفْعَلْ"},
    r'افحص|امسح|تفقّد|راقب':        {"opcode":"SCAN",    "wazn":"فعل أمر — اِفْعَلْ"},
    r'اشحن':                         {"opcode":"CHARGE",  "wazn":"فعل أمر — اِفْعَلْ"},
    r'أقلع|ارتفع|طر':               {"opcode":"LAUNCH",  "wazn":"فعل أمر — أَفْعَلْ"},
    r'قف|أوقف':                      {"opcode":"STOP",    "wazn":"فعل أمر — قِفْ"},
    r'سلّم|أنزل|وزّع':             {"opcode":"DELIVER", "wazn":"فعل أمر — فعّلْ"},
    r'عد|ارجع':                      {"opcode":"RETURN",  "wazn":"فعل أمر — عِدْ"},
}

VEHICLE_MAP = {
    r'درون|طائرة': "DRONE",
    r'رافعة':      "CRANE",
}

COND_MAP = {
    r'إذا انخفضت|إذا نقصت': {"flag":"IF_BAT_LOW"},
    r'إذا ازدحم':             {"flag":"IF_TRAFFIC"},
    r'إذا وصل':               {"flag":"IF_ARRIVED"},
}

def parse_arabic(sentence: str) -> dict:
    t0 = time.perf_counter()
    instructions = []

    # نوع المركبة من الجملة الكاملة
    vehicle_global = "VEHICLE"
    for pattern, vtype in VEHICLE_MAP.items():
        if re.search(pattern, sentence):
            vehicle_global = vtype
            break

    # تقسيم بالواو (pipeline separator)
    clauses = re.split(r'\s+و(?:َ)?\s*', sentence)

    for clause in clauses:
        clause = clause.strip()
        if not clause:
            continue

        opcode, wazn = "NOP", ""
        for pattern, info in VERB_MAP.items():
            if re.search(pattern, clause):
                opcode, wazn = info["opcode"], info["wazn"]
                break

        zone_info = None
        for key, info in OXAGON_ZONES.items():
            if key in clause:
                zone_info = info
                break

        condition = None
        for pattern, cinfo in COND_MAP.items():
            if re.search(pattern, clause):
                condition = cinfo
                break

        if opcode != "NOP":
            instructions.append({
                "id":         str(uuid.uuid4())[:8],
                "opcode":     opcode,
                "wazn":       wazn,
                "operand":    zone_info["id"] if zone_info else "NONE",
                "zone_label": zone_info["label"] if zone_info else "",
                "target":     {"x": zone_info["x"], "z": zone_info["z"]} if zone_info else None,
                "vehicle":    vehicle_global,
                "condition":  condition,
                "raw_clause": clause,
            })

    elapsed = time.perf_counter() - t0
    return {
        "sentence":      sentence,
        "instructions":  instructions,
        "parse_time_ms": round(elapsed * 1000, 4),
        "timestamp":     datetime.now().isoformat(),
        "pipeline_len":  len(instructions),
    }

# ═══════════════════════════════════════════════════════════
#  Routes
# ═══════════════════════════════════════════════════════════
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/parse", methods=["POST", "OPTIONS"])
def api_parse():
    if request.method == "OPTIONS":
        return "", 204
    data = request.get_json(silent=True) or {}
    sentence = data.get("sentence", "").strip()
    if not sentence:
        return jsonify({"error": "الجملة فارغة"}), 400
    return jsonify(parse_arabic(sentence))

@app.route("/api/zones")
def api_zones():
    return jsonify(OXAGON_ZONES)

@app.route("/api/ping")
def api_ping():
    return jsonify({"status": "ok", "engine": "NEOM-Sarf-ISA v1.0"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
