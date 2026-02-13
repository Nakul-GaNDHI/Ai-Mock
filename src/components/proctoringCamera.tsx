import React, { useEffect, useRef, useState } from "react";
import * as faceDetection from "@mediapipe/face_detection";
import { Camera } from "@mediapipe/camera_utils";

const ProctoringCamera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let camera: Camera | null = null;
    let lastWarningTime = 0;

    const showWarning = (msg: string) => {
      const now = Date.now();
      if (now - lastWarningTime > 3000) {
        setWarning(msg);
        lastWarningTime = now;
      }
    };

    // ---------- FACE DETECTOR ----------
    const faceDetector = new faceDetection.FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });

    faceDetector.setOptions({
      model: "short",
      minDetectionConfidence: 0.7,
    });

    faceDetector.onResults((results) => {
      if (!results.detections || results.detections.length === 0) {
        showWarning("⚠️ Face not detected! Stay in front of camera");
        return;
      }
      if (results.detections.length > 1) {
        showWarning("⚠️ Multiple faces detected!");
        return;
      }

      const face = results.detections[0];
      const box = face.boundingBox;
      const centerX = box.xCenter;
      const centerY = box.yCenter;

      if (centerX < 0.3 || centerX > 0.7 || centerY < 0.3) {
        showWarning("⚠️ Please look at the screen!");
      }
      if (centerY > 0.75) {
        showWarning("⚠️ Don't look down! Possible phone usage");
      }
    });

    // ---------- CAMERA AUTO-START ----------
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream; // 👈 attach stream
          camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current) {
                if (
                  videoRef.current.readyState < 2 ||
                  videoRef.current.videoWidth === 0
                ) {
                  showWarning("⚠️ Camera turned off or blocked!");
                  return;
                }
                await faceDetector.send({ image: videoRef.current });
              }
            },
            width: 320,
            height: 240,
          });
          await camera.start();
        }
      } catch {
        showWarning("⚠️ Camera permission denied!");
      }
    };

    initCamera();

    // ---------- TAB / WINDOW EVENTS ----------
    const handleVisibilityChange = () => {
      if (document.hidden) showWarning("⚠️ Tab switch detected!");
    };
    const handleBlur = () => showWarning("⚠️ Window changed or minimized!");
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) showWarning("⚠️ Fullscreen exited!");
    };
    const handleDeviceChange = () =>
      showWarning("⚠️ Camera/Microphone device changed!");

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      if (camera) camera.stop();
    };
  }, []);

  return (
    <div className="flex items-start justify-center rounded-lg overflow-hidden w-full h-full">
      {/* Video hidden from user */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ display: "none" }} // 👈 user ko video nahi dikhega
      />

      {warning && (
        <div className="mt-2 text-xs bg-red-100 text-red-700 p-2 rounded shadow">
          {warning}
        </div>
      )}
    </div>
  );
};

export default ProctoringCamera;