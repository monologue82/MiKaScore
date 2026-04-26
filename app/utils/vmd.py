import os
import struct

class VMDLoader:
    def __init__(self):
        pass
    
    def load_vmd(self, file_path):
        """加载 VMD 文件并解析动作数据"""
        with open(file_path, 'rb') as f:
            # 读取文件头
            header = f.read(30)
            model_name = f.read(20)
            
            # 读取动作帧数
            motion_count = struct.unpack('<I', f.read(4))[0]
            
            motions = []
            for _ in range(motion_count):
                bone_name = f.read(15).decode('shift-jis').rstrip('\x00')
                frame = struct.unpack('<I', f.read(4))[0]
                position = struct.unpack('<fff', f.read(12))
                rotation = struct.unpack('<ffff', f.read(16))
                interpolation = f.read(64)
                
                motions.append({
                    'bone_name': bone_name,
                    'frame': frame,
                    'position': position,
                    'rotation': rotation,
                    'interpolation': interpolation
                })
            
            # 读取表情帧数
            expression_count = struct.unpack('<I', f.read(4))[0]
            expressions = []
            for _ in range(expression_count):
                expression_name = f.read(15).decode('shift-jis').rstrip('\x00')
                frame = struct.unpack('<I', f.read(4))[0]
                weight = struct.unpack('<f', f.read(4))[0]
                
                expressions.append({
                    'expression_name': expression_name,
                    'frame': frame,
                    'weight': weight
                })
            
            # 读取相机数据（如果有）
            camera_count = struct.unpack('<I', f.read(4))[0]
            cameras = []
            for _ in range(camera_count):
                frame = struct.unpack('<I', f.read(4))[0]
                distance = struct.unpack('<f', f.read(4))[0]
                position = struct.unpack('<fff', f.read(12))
                rotation = struct.unpack('<fff', f.read(12))
                interpolation = f.read(24)
                view_angle = struct.unpack('<I', f.read(4))[0]
                perspective = struct.unpack('B', f.read(1))[0]
                
                cameras.append({
                    'frame': frame,
                    'distance': distance,
                    'position': position,
                    'rotation': rotation,
                    'interpolation': interpolation,
                    'view_angle': view_angle,
                    'perspective': perspective
                })
            
            # 读取光源数据（如果有）
            light_count = struct.unpack('<I', f.read(4))[0]
            lights = []
            for _ in range(light_count):
                frame = struct.unpack('<I', f.read(4))[0]
                color = struct.unpack('<fff', f.read(12))
                position = struct.unpack('<fff', f.read(12))
                
                lights.append({
                    'frame': frame,
                    'color': color,
                    'position': position
                })
            
            return {
                'header': header,
                'model_name': model_name,
                'motions': motions,
                'expressions': expressions,
                'cameras': cameras,
                'lights': lights
            }
    
    def get_motion_list(self, motion_dir):
        """获取动作库列表"""
        motion_list = []
        
        if os.path.exists(motion_dir):
            for folder in os.listdir(motion_dir):
                folder_path = os.path.join(motion_dir, folder)
                if os.path.isdir(folder_path):
                    motion_files = []
                    audio_files = []
                    
                    for file in os.listdir(folder_path):
                        if file.endswith('.vmd'):
                            motion_files.append(file)
                        elif file.endswith('.wav'):
                            audio_files.append(file)
                    
                    motion_list.append({
                        'name': folder,
                        'vmdCount': len(motion_files),
                        'vmdFiles': motion_files,
                        'hasAudio': len(audio_files) > 0,
                        'audioName': audio_files[0] if audio_files else None,
                        'folder': folder,
                        'motion': motion_files[0] if motion_files else None
                    })
        
        return motion_list
