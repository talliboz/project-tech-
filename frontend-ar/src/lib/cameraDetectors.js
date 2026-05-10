import { FaceDetector, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

const wasmUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
const faceModelUrl =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
const handModelUrl =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

let visionFilesetPromise

async function getVisionFileset() {
  visionFilesetPromise ??= FilesetResolver.forVisionTasks(wasmUrl)
  return visionFilesetPromise
}

export async function createHandDetector() {
  const vision = await getVisionFileset()
  const detector = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: handModelUrl,
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.45,
    minHandPresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
  })

  return {
    detect(video, timestamp) {
      const result = detector.detectForVideo(video, timestamp)

      return result.landmarks.map((landmarks, index) => ({
        keypoints: landmarks,
        handedness: result.handedness[index]?.[0]?.categoryName,
        score: result.handedness[index]?.[0]?.score ?? 0.85,
      }))
    },
    dispose() {
      detector.close()
    },
  }
}

export async function createFaceDetector() {
  const vision = await getVisionFileset()
  const detector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: faceModelUrl,
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.45,
  })

  return {
    detect(video, timestamp) {
      const result = detector.detectForVideo(video, timestamp)

      return result.detections.map((detection) => ({
        box: detection.boundingBox,
        keypoints: detection.keypoints,
        score: detection.categories[0]?.score ?? 0.85,
      }))
    },
    dispose() {
      detector.close()
    },
  }
}
