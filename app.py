from flask import Flask, render_template, request, jsonify
import os

app = Flask(__name__, 
            template_folder=os.path.join(os.path.dirname(__file__), 'app/templates'),
            static_folder=os.path.join(os.path.dirname(__file__), 'app/static'))

app.config['SECRET_KEY'] = 'secret_key'

app.config['UPLOAD_FOLDER'] = 'app/static/uploads'
app.config['MMD_MODELS'] = 'mmd/models'
app.config['MMD_MOTIONS'] = 'mmd/motion'

# 导入路由
from app.routes.main import main
app.register_blueprint(main)

# 导入WebSocket
try:
    from app.utils.websocket import WebSocketServer
    ws_server = WebSocketServer(app)
except Exception as e:
    print(f"WebSocket 初始化失败: {e}")
    ws_server = None

if __name__ == '__main__':
    if ws_server:
        ws_server.run()
    else:
        app.run(debug=True, host='0.0.0.0', port=5000)
