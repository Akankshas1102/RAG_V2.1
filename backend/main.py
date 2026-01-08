from flask import Flask, request, jsonify
from flask_cors import CORS
from app.rag_engine import answer_query

app = Flask(__name__)
CORS(app)

@app.route("/query", methods=["POST"])
def handle_query():
    try:
        data = request.get_json()
        print("[+] Received request:", data)
        user_query = data.get("query", "")
        if not user_query.strip():
            return jsonify({"error": "Query cannot be empty."}), 400
        print("[+] Processing query...")
        answer = answer_query(user_query)
        print("[+] Got answer:", answer)
        return jsonify({"answer": answer})
    except Exception as e:
        print(f"[!] Error: {e}")
        return jsonify({"error": "An error occurred while processing your query."}), 500 

if __name__ == "__main__":
    app.run(debug=True)