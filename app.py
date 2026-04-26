"""
OXAGON Digital Twin — Sarf ISA Backend
نظام صَرْف ISA لمدينة أوكساجون
"""
import re
import time
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ═══════════════════════════════════════════════════════════
#  خريطة أوكساجون — Oxagon Zone Registry
# ═══════════════════════════════════════════════════════════
OXAGON_ZONES = {
    # المنطقة اللوجستية
    "ميناء":          {"id": "PORT",       "x":  120, "z": -80,  "type": "port",      "label": "ميناء أوكساجون"},
    "المنطقة اللوجستية":{"id": "LOGISTICS", "x":  60,  "z":  20,  "type": "logistics", "label": "المنطقة اللوجستية"},
    "مستودع":         {"id": "WAREHOUSE",  "x":  80,  "z":  60,  "type": "logistics", "label": "مستودع المواد"},
    "الحاويات":       {"id": "CONTAINERS", "x": 140,  "z": -40,  "type": "port",      "label": "منطقة الحاويات"},

    # المنطقة الصناعية
    "المصنع":         {"id": "FACTORY",    "x": -60,  "z": -60,  "type": "industry",  "label": "المصنع الرئيسي"},
    "الطاقة":         {"id": "ENERGY",     "x": -120, "z":  20,  "type": "energy",    "label": "محطة الطاقة"},
    "محطة الشحن":     {"id": "CHARGE",     "x": -80,  "z":  80,  "type": "energy",    "label": "محطة الشحن"},

    # المنطقة السكنية
    "السكن":          {"id": "RESIDENTIAL","x":  20,  "z":  100, "type": "residential","label": "الحي السكني"},
    "المركز":         {"id": "CENTER",     "x":  0,   "z":  0,   "type": "hub",        "label": "مركز أوكساجون"},
    "المطار":         {"id": "AIRPORT",    "x": -140, "z": -80,  "type": "airport",    "label": "مطار أوكساجون"},
}

# ═══════════════════════════════════════════════════════════
#  محرك صَرْف ISA
# ═══════════════════════════════════════════════════════════
VERB_MAP = {
    r'انطلق|توجّه|توجه|اذهب|انتقل': {"opcode": "MOVE",   "wazn": "فعل أمر — اِفْعَلْ"},
    r'افحص|امسح|تفقّد|راقب':         {"opcode": "SCAN",   "wazn": "فعل أمر — اِفْعَلْ"},
    r'اشحن':                          {"opcode": "CHARGE", "wazn": "فعل أمر — اِفْعَلْ"},
    r'أقلع|ارتفع|طر':                 {"opcode": "LAUNCH", "wazn": "فعل أمر — أَفْعَلْ"},
    r'قف|أوقف|ابق':                   {"opcode": "STOP",   "wazn": "فعل أمر — قِفْ"},
    r'سلّم|أنزل|وزّع':               {"opcode": "DELIVER","wazn": "فعل أمر — فعّلْ"},
    r'عد|ارجع|ارجوع':                 {"opcode": "RETURN", "wazn": "فعل أمر — عِدْ"},
}

VEHICLE_MAP = {
    r'مركبة|سيارة|ناقلة':  "VEHICLE",
    r'درون|طائرة|drone':   "DRONE",
    r'رافعة|رافعه':        "CRANE",
}

COND_MAP = {
    r'إذا انخفضت|إذا نقصت البطارية': {"flag": "IF_BAT_LOW",  "threshold": 20},
    r'إذا ازدحم|عند الازدحام':        {"flag": "IF_TRAFFIC",  "threshold": 2},
    r'إذا وصل|عند الوصول':            {"flag": "IF_ARRIVED",  "threshold": None},
}

def parse_arabic(sentence: str) -> dict:
    """تحليل الجملة العربية وتوليد تعليمات ISA"""
    t_start = time.perf_counter()

    instructions = []
    # تقسيم بالواو (pipeline)
    clauses = re.split(r'\s+و(?:َ)?\s*', sentence)

    for clause in clauses:
        clause = clause.strip()
        if not clause:
            continue

        opcode, wazn = "NOP", ""
        for pattern, info in VERB_MAP.items():
            if re.search(pattern, clause):
                opcode = info["opcode"]
                wazn   = info["wazn"]
                break

        # استخراج الوجهة
        zone = None
        zone_info = None
        for key, info in OXAGON_ZONES.items():
            if key in clause:
                zone      = key
                zone_info = info
                break

        # استخراج نوع المركبة
        vehicle = "VEHICLE"
        for pattern, vtype in VEHICLE_MAP.items():
            if re.search(pattern, clause):
                vehicle = vtype
                break
        if re.search(r'درون|طائرة|drone', sentence, re.IGNORECASE):
            vehicle = "DRONE"

        # استخراج الشرط
        condition = None
        for pattern, cinfo in COND_MAP.items():
            if re.search(pattern, clause):
                condition = cinfo
                break

        if opcode != "NOP":
            inst = {
                "id":        str(uuid.uuid4())[:8],
                "opcode":    opcode,
                "wazn":      wazn,
                "operand":   zone_info["id"] if zone_info else "NONE",
                "zone_label": zone_info["label"] if zone_info else "",
                "target":    {"x": zone_info["x"], "z": zone_info["z"]} if zone_info else None,
                "vehicle":   vehicle,
                "condition": condition,
                "raw_clause": clause,
            }
            instructions.append(inst)

    elapsed = time.perf_counter() - t_start

    return {
        "sentence":     sentence,
        "instructions": instructions,
        "parse_time_ms": round(elapsed * 1000, 4),
        "timestamp":    datetime.now().isoformat(),
        "pipeline_len": len(instructions),
    }

# ═══════════════════════════════════════════════════════════
#  Routes
# ═══════════════════════════════════════════════════════════
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/parse", methods=["POST"])
def api_parse():
    data = request.get_json()
    sentence = data.get("sentence", "").strip()
    if not sentence:
        return jsonify({"error": "الجملة فارغة"}), 400
    result = parse_arabic(sentence)
    return jsonify(result)

@app.route("/api/zones", methods=["GET"])
def api_zones():
    return jsonify(OXAGON_ZONES)

@app.route("/api/ping", methods=["GET"])
def api_ping():
    return jsonify({"status": "ok", "engine": "NEOM-Sarf-ISA v1.0"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
