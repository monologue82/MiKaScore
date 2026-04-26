from flask import Blueprint, render_template, jsonify, request, send_from_directory
import os
import json
from app.utils.vmd import VMDLoader

main = Blueprint('main', __name__, template_folder='../templates')
vmd_loader = VMDLoader()

# Serve mmd directory
@main.route('/mmd/<path:filename>')
def serve_mmd(filename):
    mmd_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../mmd'))
    file_path = os.path.join(mmd_dir, filename)
    print(f'Serving: {filename}, exists: {os.path.exists(file_path)}, path: {file_path}')
    return send_from_directory(mmd_dir, filename)

# Serve reze-engine public directory (animations and audios)
@main.route('/animations/<path:filename>')
def serve_animations(filename):
    public_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../reze-engine/web/public/animations'))
    return send_from_directory(public_dir, filename)

@main.route('/audios/<path:filename>')
def serve_audios(filename):
    public_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../reze-engine/web/public/audios'))
    return send_from_directory(public_dir, filename)

# Serve uploaded models directory
@main.route('/uploads/models/<path:filename>')
def serve_uploaded_models(filename):
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../uploads/models'))
    file_path = os.path.join(models_dir, filename)
    print(f'Serving uploaded model: {filename}, exists: {os.path.exists(file_path)}, path: {file_path}')
    return send_from_directory(models_dir, filename)

@main.route('/')
def index():
    # 获取动作库列表
    motion_dir = 'mmd/motion'
    motion_list = vmd_loader.get_motion_list(motion_dir)
    
    return render_template('index.html', motion_list=motion_list)

@main.route('/simple')
def simple():
    return render_template('simple.html')

@main.route('/debug')
def debug():
    return render_template('debug.html')

@main.route('/api/motions')
def get_motions():
    # 获取动作库列表的API
    motion_dir = 'mmd/motion'
    motion_list = vmd_loader.get_motion_list(motion_dir)
    
    return jsonify(motion_list)

@main.route('/api/load_motion', methods=['POST'])
def load_motion():
    # 加载动作的API
    data = request.json
    folder = data.get('folder')
    motion_file = data.get('motion')
    
    if not folder or not motion_file:
        return jsonify({'error': '缺少必要参数'}), 400
    
    motion_path = os.path.join('mmd/motion', folder, motion_file)
    audio_path = None
    
    # 查找音频文件
    motion_dir = os.path.join('mmd/motion', folder)
    for file in os.listdir(motion_dir):
        if file.endswith('.wav'):
            audio_path = os.path.join(motion_dir, file)
            break
    
    try:
        # 加载VMD文件
        vmd_data = vmd_loader.load_vmd(motion_path)
        
        return jsonify({
            'success': True,
            'motion_path': motion_path,
            'audio_path': audio_path,
            'motion_data': {
                'frame_count': len(vmd_data['motions']),
                'bone_count': len(set([m['bone_name'] for m in vmd_data['motions']]))
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@main.route('/api/score', methods=['POST'])
def score():
    # 骨骼匹配和评分的API
    from app.utils.scoring import SkeletonMatcher
    
    data = request.json
    camera_landmarks = data.get('camera_landmarks')
    motion_landmarks = data.get('motion_landmarks')
    
    if not camera_landmarks or not motion_landmarks:
        return jsonify({'error': '缺少必要参数'}), 400
    
    try:
        matcher = SkeletonMatcher()
        
        # 转换 camera_landmarks 为 MediaPipe 格式
        class Landmark:
            def __init__(self, x, y, z):
                self.x = x
                self.y = y
                self.z = z
        
        class Landmarks:
            def __init__(self, landmarks):
                self.landmark = [Landmark(**l) for l in landmarks]
        
        camera_landmarks_obj = Landmarks(camera_landmarks)
        motion_landmarks_obj = Landmarks(motion_landmarks)
        
        # 计算相似度
        similarity = matcher.calculate_similarity(camera_landmarks_obj, motion_landmarks_obj)
        
        # 获取评分等级
        rating = matcher.get_rating(similarity)
        
        return jsonify({
            'success': True,
            'similarity': similarity,
            'rating': rating
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@main.route('/api/upload-model', methods=['POST'])
def upload_model():
    # 模型上传的API
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': '文件名为空'}), 400
    
    import zipfile
    import io
    
    try:
        # 创建上传目录
        upload_dir = os.path.join(os.path.dirname(__file__), '../../uploads/models')
        os.makedirs(upload_dir, exist_ok=True)
        
        # 获取模型名称（不带扩展名）
        filename = file.filename
        model_name = os.path.splitext(filename)[0]
        
        # 检查文件类型
        if filename.endswith('.zip'):
            # 处理 zip 文件
            try:
                # 读取整个 zip 文件到内存
                zip_data = file.read()
                zip_file = zipfile.ZipFile(io.BytesIO(zip_data))
                
                # 创建模型专用目录
                model_dir = os.path.join(upload_dir, model_name)
                if os.path.exists(model_dir):
                    import shutil
                    shutil.rmtree(model_dir)
                os.makedirs(model_dir)
                
                # 解压所有文件
                zip_file.extractall(model_dir)
                zip_file.close()
                
                # 查找 PMX 文件
                pmx_file = None
                for root, dirs, files in os.walk(model_dir):
                    for f in files:
                        if f.endswith('.pmx'):
                            pmx_file = os.path.join(root, f)
                            break
                
                if not pmx_file:
                    # 删除空目录
                    import shutil
                    shutil.rmtree(model_dir)
                    return jsonify({'error': '压缩包中没有找到 .pmx 文件'}), 400
                
                # 计算相对路径
                rel_path = os.path.relpath(pmx_file, os.path.dirname(__file__))
                pmx_path = f'/uploads/models/{model_name}/{os.path.basename(pmx_file)}'
                
                return jsonify({
                    'success': True,
                    'name': model_name,
                    'path': pmx_path,
                    'isFolder': True,
                    'folderPath': f'/uploads/models/{model_name}'
                })
                
            except zipfile.BadZipFile:
                return jsonify({'error': '无效的 zip 文件'}), 400
            except Exception as e:
                return jsonify({'error': f'解压失败: {str(e)}'}), 500
                
        elif filename.endswith('.pmx'):
            # 处理单个 PMX 文件
            # 如果已存在同名目录，删除它
            model_dir = os.path.join(upload_dir, model_name)
            if os.path.exists(model_dir):
                import shutil
                shutil.rmtree(model_dir)
            
            # 保存 PMX 文件
            model_path = os.path.join(upload_dir, f'{model_name}.pmx')
            file.save(model_path)
            
            return jsonify({
                'success': True,
                'name': model_name,
                'path': f'/uploads/models/{model_name}.pmx',
                'isFolder': False
            })
        else:
            return jsonify({'error': '只支持 .zip 或 .pmx 格式的文件'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@main.route('/api/upload-motion', methods=['POST'])
def upload_motion():
    # 动作上传的API
    if 'files' not in request.files:
        return jsonify({'error': '没有文件'}), 400
    
    files = request.files.getlist('files')
    
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': '文件名为空'}), 400
    
    try:
        # 创建上传目录
        upload_dir = os.path.join(os.path.dirname(__file__), '../../mmd/motion')
        
        # 检查是否同时上传了 VMD 和 WAV 文件
        vmd_files = [f for f in files if f.filename.lower().endswith('.vmd')]
        wav_files = [f for f in files if f.filename.lower().endswith('.wav')]
        
        if not vmd_files:
            return jsonify({'error': '至少需要上传一个 .vmd 文件'}), 400
        
        # 使用第一个 VMD 文件的名称作为目录名
        first_vmd = vmd_files[0]
        motion_name = os.path.splitext(first_vmd.filename)[0]
        motion_dir = os.path.join(upload_dir, motion_name)
        
        # 如果目录已存在，删除它
        if os.path.exists(motion_dir):
            import shutil
            shutil.rmtree(motion_dir)
        
        os.makedirs(motion_dir)
        
        # 保存所有文件
        for f in files:
            if f.filename:
                save_path = os.path.join(motion_dir, f.filename)
                f.save(save_path)
                print(f'Saved: {save_path}')
        
        return jsonify({
            'success': True,
            'name': motion_name,
            'folder': motion_name
        })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
