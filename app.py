import re, time, uuid, os
from datetime import datetime
from flask import Flask, request, jsonify, render_template

# تعريف التطبيق مع تحديد مجلدات الملفات الثابتة والقوالب
app = Flask(__name__, static_url_path='/static', static_folder='static', template_folder='templates')

@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response

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

VERB_MAP = {
    r'انطلق|توجّه|توجه|اذهب|انتقل': {"opcode":"MOVE",    "wazn":"فعل أمر"},
    r'افحص|امسح|تفقّد|راقب':        {"opcode":"SCAN",    "wazn":"فعل أمر"},
    r'اشحن':                         {"opcode":"CHARGE",  "wazn":"فعل أمر"},
}

def parse_arabic(sentence):
    instructions = []
    clauses = re.split(r'\s+و(?:َ)?\s*', sentence)
    for clause in clauses:
        clause = clause.strip()
        opcode = "NOP"
        for pattern, info in VERB_MAP.items():
            if re.search(pattern, clause): opcode = info["opcode"]; break
        zone_info = next((info for key, info in OXAGON_ZONES.items() if key in clause), None)
        if opcode != "NOP":
            instructions.append({
                "opcode": opcode,
                "operand": zone_info["id"] if zone_info else "NONE",
                "zone_label": zone_info["label"] if zone_info else ""
            })
    return {"sentence": sentence, "instructions": instructions, "parse_time_ms": 10}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/parse", methods=["POST"])
def api_parse():
    data = request.get_json() or {}
    return jsonify(parse_arabic(data.get("sentence", "")))

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
