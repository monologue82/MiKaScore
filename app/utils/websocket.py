from flask_socketio import SocketIO, emit
import cv2
import base64
import numpy as np
from app.utils.camera import CameraProcessor

class WebSocketServer:
    def __init__(self, app):
        self.app = app
        self.socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
        self.camera = CameraProcessor()
        self.is_running = False
        
        # 注册事件处理器
        self.socketio.on_event('connect', self.on_connect)
        self.socketio.on_event('disconnect', self.on_disconnect)
        self.socketio.on_event('start_camera', self.on_start_camera)
        self.socketio.on_event('stop_camera', self.on_stop_camera)
    
    def on_connect(self):
        print('客户端连接')
        emit('connected', {'message': '连接成功'})
    
    def on_disconnect(self):
        print('客户端断开连接')
        self.stop_camera()
    
    def on_start_camera(self):
        print('开始摄像头')
        if not self.is_running:
            if self.camera.start_camera():
                self.is_running = True
                self.socketio.start_background_task(self.process_frames)
                emit('camera_started', {'message': '摄像头已启动'})
            else:
                emit('camera_error', {'message': '无法启动摄像头'})
    
    def on_stop_camera(self):
        print('停止摄像头')
        self.stop_camera()
        emit('camera_stopped', {'message': '摄像头已停止'})
    
    def stop_camera(self):
        if self.is_running:
            self.is_running = False
            self.camera.stop_camera()
    
    def process_frames(self):
        while self.is_running:
            frame = self.camera.get_frame()
            if frame is not None:
                # 处理帧
                processed_frame = self.camera.process_frame(frame)
                
                # 编码为 base64
                _, buffer = cv2.imencode('.jpg', processed_frame)
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
                
                # 发送帧
                self.socketio.emit('frame', {'image': frame_base64})
                
                # 获取 landmarks
                landmarks = self.camera.get_landmarks()
                if landmarks:
                    # 转换 landmarks 为可序列化的格式
                    landmarks_data = []
                    for landmark in landmarks.landmark:
                        landmarks_data.append({
                            'x': landmark.x,
                            'y': landmark.y,
                            'z': landmark.z
                        })
                    self.socketio.emit('landmarks', {'landmarks': landmarks_data})
            
            # 控制帧率
            self.socketio.sleep(1/30)  # 30fps
    
    def run(self):
        self.socketio.run(self.app, debug=True, host='0.0.0.0', port=5000)
