import cv2
import numpy as np
import os

class CameraProcessor:
    def __init__(self):
        self.cap = None
        self.landmarks = None
        self.pose_available = False
        self.detector = None

        try:
            from mediapipe.tasks import python
            from mediapipe.tasks.python import vision

            model_path = self._get_model_path()
            if not os.path.exists(model_path):
                print(f"Downloading pose landmarker model to {model_path}...")
                self._download_model(model_path)

            print(f"Loading model from: {model_path}")
            base_options = python.BaseOptions(model_asset_path=model_path)
            options = vision.PoseLandmarkerOptions(
                base_options=base_options,
                running_mode=vision.RunningMode.VIDEO,
                num_poses=1,
                min_pose_detection_confidence=0.5,
                min_pose_presence_confidence=0.5,
                min_tracking_confidence=0.5,
                output_segmentation_masks=False
            )
            self.detector = vision.PoseLandmarker.create_from_options(options)
            self.pose_available = True
            print("MediaPipe PoseLandmarker initialized successfully")
        except Exception as e:
            print(f"MediaPipe import failed: {e}")
            import traceback
            traceback.print_exc()
            self.pose_available = False

    def _get_model_path(self):
        app_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        model_dir = os.path.join(app_dir, 'models')
        os.makedirs(model_dir, exist_ok=True)
        path = os.path.join(model_dir, 'pose_landmarker.task')
        return path.replace('\\', '/')

    def _download_model(self, dest_path):
        import urllib.request
        url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
        print(f"Downloading from {url}...")
        urllib.request.urlretrieve(url, dest_path)
        print(f"Model downloaded to {dest_path}")

    def start_camera(self, width=1920, height=1080, fps=30):
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS, fps)
        return self.cap.isOpened()

    def process_frame(self, frame):
        if not self.pose_available or self.detector is None:
            return frame

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = vision.Image(image_format=vision.ImageFormat.SRGB, data=rgb_frame)

        timestamp_ms = int(self.cap.get(cv2.CAP_PROP_POS_MSEC)) if self.cap else 0
        result = self.detector.detect_for_video(mp_image, timestamp_ms)

        if result is not None and result.pose_landmarks:
            self.landmarks = result.pose_landmarks[0]

            h, w = frame.shape[:2]
            for landmark in result.pose_landmarks[0]:
                x = int(landmark.x * w)
                y = int(landmark.y * h)
                cv2.circle(frame, (x, y), 5, (245, 117, 66), -1)

            connections = [
                (11, 12), (12, 14), (14, 16), (11, 13), (13, 15),
                (11, 23), (23, 24), (24, 26), (26, 28), (23, 25), (25, 27)
            ]
            for start_idx, end_idx in connections:
                start = result.pose_landmarks[0][start_idx]
                end = result.pose_landmarks[0][end_idx]
                start_point = (int(start.x * w), int(start.y * h))
                end_point = (int(end.x * w), int(end.y * h))
                cv2.line(frame, start_point, end_point, (245, 66, 230), 2)

        return frame

    def get_landmarks(self):
        return self.landmarks

    def stop_camera(self):
        if self.cap:
            self.cap.release()
        if self.detector:
            self.detector.close()

    def get_frame(self):
        if self.cap and self.cap.isOpened():
            ret, frame = self.cap.read()
            if ret:
                return frame
        return None