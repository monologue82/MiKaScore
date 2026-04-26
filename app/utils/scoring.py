import numpy as np

class SkeletonMatcher:
    def __init__(self):
        pass
    
    def calculate_similarity(self, camera_landmarks, motion_landmarks):
        """计算摄像头骨骼与动作骨骼的相似度"""
        if not camera_landmarks or not motion_landmarks:
            return 0.0
        
        # 提取关键骨骼点
        camera_points = self.extract_key_points(camera_landmarks)
        motion_points = self.extract_key_points(motion_landmarks)
        
        if len(camera_points) != len(motion_points):
            return 0.0
        
        # 计算欧氏距离
        total_distance = 0
        for (cx, cy), (mx, my) in zip(camera_points, motion_points):
            distance = np.sqrt((cx - mx)**2 + (cy - my)**2)
            total_distance += distance
        
        # 归一化相似度
        max_distance = np.sqrt(2) * len(camera_points)  # 最大可能距离
        similarity = 1.0 - (total_distance / max_distance)
        
        return max(0.0, min(1.0, similarity))
    
    def extract_key_points(self, landmarks):
        """提取关键骨骼点"""
        key_points = []
        
        # 关键点索引（根据MediaPipe的Pose模型）
        key_indices = [0,  # 鼻子
                      11, 12,  # 肩膀
                      13, 14,  # 肘部
                      15, 16,  # 手腕
                      23, 24,  # 臀部
                      25, 26,  # 膝盖
                      27, 28]  # 脚踝
        
        for idx in key_indices:
            if idx < len(landmarks.landmark):
                landmark = landmarks.landmark[idx]
                key_points.append((landmark.x, landmark.y))
        
        return key_points
    
    def get_rating(self, similarity):
        """根据相似度获取评分等级"""
        if similarity >= 0.95:
            return "Perfect"
        elif similarity >= 0.85:
            return "Great"
        elif similarity >= 0.75:
            return "Good"
        elif similarity >= 0.6:
            return "Bad"
        else:
            return "Miss"
    
    def calculate_score(self, ratings):
        """根据评分等级计算总分"""
        score_map = {
            "Perfect": 10,
            "Great": 8,
            "Good": 6,
            "Bad": 3,
            "Miss": 0
        }
        
        total_score = 0
        for rating in ratings:
            total_score += score_map.get(rating, 0)
        
        # 归一化到100分
        max_score = len(ratings) * 10
        if max_score > 0:
            final_score = (total_score / max_score) * 100
        else:
            final_score = 0
        
        return int(final_score)
