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
      // No face
      if (!results.detections || results.detections.length === 0) {
        showWarning("⚠️ Face not detected! Stay in front of camera");
        return;
      }

      // Multiple faces
      if (results.detections.length > 1) {
        showWarning("⚠️ Multiple faces detected!");
        return;
      }

      // Face position analysis
      const face = results.detections[0];
      const box = face.boundingBox;

      const centerX = box.xCenter;
      const centerY = box.yCenter;

      // Looking left/right/up
      if (centerX < 0.3 || centerX > 0.7 || centerY < 0.3) {
        showWarning("⚠️ Please look at the screen!");
      }

      // Looking down (possible phone usage)
      if (centerY > 0.75) {
        showWarning("⚠️ Don't look down! Possible phone usage");
      }
    });

    // ---------- CAMERA ----------
    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            // Camera off / blocked check
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

      camera.start().catch(() => {
        showWarning("⚠️ Camera permission denied!");
      });
    }

    // ---------- TAB SWITCH ----------
    const handleVisibilityChange = () => {
      if (document.hidden) {
        showWarning("⚠️ Tab switch detected!");
      }
    };

    // ---------- WINDOW BLUR / MINIMIZE ----------
    const handleBlur = () => {
      showWarning("⚠️ Window changed or minimized!");
    };

    // ---------- FULLSCREEN EXIT ----------
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        showWarning("⚠️ Fullscreen exited!");
      }
    };

    // ---------- DEVICE CHANGE ----------
    const handleDeviceChange = () => {
      showWarning("⚠️ Camera/Microphone device changed!");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
      if (camera) camera.stop();
    };
  }, []);

  return (
    <div className="flex items-center justify-center rounded-lg overflow-hidden w-full h-full">

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-40 h-32 rounded-lg border-2 border-red-500 bg-black"
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
