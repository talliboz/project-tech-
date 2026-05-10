import { useEffect, useRef, useState } from 'react'
import {
  createFaceDetector,
  createHandDetector,
} from '../frontend-ar/src/lib/cameraDetectors'

const faultTriggers = {
  right: 'Track signal fault',
  left: 'Door sensor failure',
  face: 'Lighting outage',
}

const fallbackFaults = {
  [faultTriggers.right]: {
    id: 'F1',
    title: faultTriggers.right,
    location: 'North platform',
    severity: 'high',
  },
  [faultTriggers.left]: {
    id: 'F2',
    title: faultTriggers.left,
    location: 'East carriage',
    severity: 'medium',
  },
  [faultTriggers.face]: {
    id: 'F3',
    title: faultTriggers.face,
    location: 'West concourse',
    severity: 'low',
  },
}

export function ArCamera({ dashboard }) {
  const cameraVideoRef = useRef(null)
  const handDetectorRef = useRef(null)
  const faceDetectorRef = useRef(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraStatus, setCameraStatus] = useState('Ready')
  const [detectedFaults, setDetectedFaults] = useState([])
  const cameraStateLabel = isCameraActive ? 'Live scan' : 'Idle'
  const detectionCountLabel =
    detectedFaults.length === 1 ? '1 fault item found' : `${detectedFaults.length} fault items found`

  const getFaultReport = (title) =>
    dashboard.faults.find((fault) => fault.title === title) ?? fallbackFaults[title]

  const toSourcePixel = (value, size) => {
    if (!Number.isFinite(value)) {
      return 0
    }

    return Math.abs(value) <= 1 ? value * size : value
  }

  const expandBounds = (bounds, scale = 1.25) => {
    const width = bounds.width * scale
    const height = bounds.height * scale
    const xMin = bounds.xMin - (width - bounds.width) / 2
    const yMin = bounds.yMin - (height - bounds.height) / 2

    return {
      xMin,
      yMin,
      width,
      height,
    }
  }

  const clampPercent = (value) => Math.min(100, Math.max(0, value))

  const createBox = (bounds, video) => {
    const frameWidth = video.clientWidth || video.videoWidth
    const frameHeight = video.clientHeight || video.videoHeight
    const sourceWidth = video.videoWidth || frameWidth
    const sourceHeight = video.videoHeight || frameHeight
    const scale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight)
    const renderedWidth = sourceWidth * scale
    const renderedHeight = sourceHeight * scale
    const offsetX = (frameWidth - renderedWidth) / 2
    const offsetY = (frameHeight - renderedHeight) / 2
    const left = ((bounds.xMin * scale + offsetX) / frameWidth) * 100
    const top = ((bounds.yMin * scale + offsetY) / frameHeight) * 100
    const width = (bounds.width * scale * 100) / frameWidth
    const height = (bounds.height * scale * 100) / frameHeight

    return {
      left: `${clampPercent(left)}%`,
      top: `${clampPercent(top)}%`,
      width: `${Math.min(100, Math.max(12, width))}%`,
      height: `${Math.min(100, Math.max(12, height))}%`,
    }
  }

  const getKeypointBounds = (keypoints, videoWidth, videoHeight) => {
    if (!keypoints.length) {
      return null
    }

    const xValues = keypoints.map((keypoint) => toSourcePixel(keypoint.x, videoWidth))
    const yValues = keypoints.map((keypoint) => toSourcePixel(keypoint.y, videoHeight))
    const minX = Math.min(...xValues)
    const maxX = Math.max(...xValues)
    const minY = Math.min(...yValues)
    const maxY = Math.max(...yValues)

    return {
      xMin: minX,
      yMin: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  const getHandBounds = (hand, videoWidth, videoHeight) => {
    const bounds = getKeypointBounds(hand.keypoints ?? [], videoWidth, videoHeight)

    return bounds ? expandBounds(bounds, 1.7) : null
  }

  const getFaceBounds = (face, videoWidth, videoHeight) => {
    const box = face.box

    if (!box) {
      const bounds = getKeypointBounds(face.keypoints ?? [], videoWidth, videoHeight)

      return bounds ? expandBounds(bounds, 3.2) : null
    }

    if (Number.isFinite(box.originX) && Number.isFinite(box.originY)) {
      return expandBounds(
        {
          xMin: box.originX,
          yMin: box.originY,
          width: box.width,
          height: box.height,
        },
        1.12,
      )
    }

    if (Array.isArray(box.topLeft) && Array.isArray(box.bottomRight)) {
      const xMin = toSourcePixel(box.topLeft[0], videoWidth)
      const yMin = toSourcePixel(box.topLeft[1], videoHeight)
      const xMax = toSourcePixel(box.bottomRight[0], videoWidth)
      const yMax = toSourcePixel(box.bottomRight[1], videoHeight)

      return {
        xMin,
        yMin,
        width: xMax - xMin,
        height: yMax - yMin,
      }
    }

    if (box.topLeft && box.bottomRight) {
      const xMin = toSourcePixel(box.topLeft.x, videoWidth)
      const yMin = toSourcePixel(box.topLeft.y, videoHeight)
      const xMax = toSourcePixel(box.bottomRight.x, videoWidth)
      const yMax = toSourcePixel(box.bottomRight.y, videoHeight)

      return {
        xMin,
        yMin,
        width: xMax - xMin,
        height: yMax - yMin,
      }
    }

    const xMin = toSourcePixel(box.xMin ?? box.x, videoWidth)
    const yMin = toSourcePixel(box.yMin ?? box.y, videoHeight)
    const width = Number.isFinite(box.width)
      ? toSourcePixel(box.width, videoWidth)
      : toSourcePixel(box.xMax, videoWidth) - xMin
    const height = Number.isFinite(box.height)
      ? toSourcePixel(box.height, videoHeight)
      : toSourcePixel(box.yMax, videoHeight) - yMin

    return expandBounds({ xMin, yMin, width, height }, 1.12)
  }

  const isRaisedHand = (hand, videoHeight) => {
    const keypoints = hand.keypoints ?? []
    const wrist = keypoints.find((keypoint) => keypoint.name === 'wrist') ?? keypoints[0]
    const highestPoint = Math.min(
      ...keypoints.map((keypoint) => toSourcePixel(keypoint.y, videoHeight)),
    )
    const wristY = toSourcePixel(wrist?.y, videoHeight)
    const triggerDistance = videoHeight * 0.12

    return wrist && highestPoint < wristY - triggerDistance
  }

  const getHandSide = (hand, bounds) => {
    if (hand.handedness === 'Left' || hand.handedness === 'Right') {
      return hand.handedness.toLowerCase()
    }

    return bounds.xMin + bounds.width / 2 < 50 ? 'right' : 'left'
  }

  const loadDetectors = async () => {
    if (!handDetectorRef.current) {
      handDetectorRef.current = await createHandDetector()
    }

    if (!faceDetectorRef.current) {
      faceDetectorRef.current = await createFaceDetector()
    }
  }

  const detectCameraFaults = async () => {
    const video = cameraVideoRef.current

    if (
      !video ||
      video.readyState < 2 ||
      !handDetectorRef.current ||
      !faceDetectorRef.current
    ) {
      return []
    }

    const videoWidth = video.videoWidth || video.clientWidth
    const videoHeight = video.videoHeight || video.clientHeight
    const timestamp = performance.now()
    const hands = handDetectorRef.current.detect(video, timestamp)
    const faces = faceDetectorRef.current.detect(video, timestamp)
    const results = []
    const detectedTitles = new Set()

    hands.forEach((hand) => {
      const bounds = getHandBounds(hand, videoWidth, videoHeight)

      if (!bounds || !isRaisedHand(hand, videoHeight)) {
        return
      }

      const side = getHandSide(hand, bounds)
      const title = side === 'right' ? faultTriggers.right : faultTriggers.left

      if (detectedTitles.has(title)) {
        return
      }

      const fault = getFaultReport(title)
      detectedTitles.add(title)

      results.push({
        id: fault.id,
        title: fault.title,
        location: fault.location,
        severity: fault.severity,
        trigger: `${fault.title} linked`,
        confidence: Math.round((hand.score ?? 0.82) * 100),
        box: createBox(bounds, video),
      })
    })

    if (faces.length > 0) {
      const fault = getFaultReport(faultTriggers.face)
      const face = faces[0]
      const bounds = getFaceBounds(face, videoWidth, videoHeight)

      if (!bounds) {
        return results
      }

      results.push({
        id: fault.id,
        title: fault.title,
        location: fault.location,
        severity: fault.severity,
        trigger: `${fault.title} linked`,
        confidence: Math.round((face.score?.[0] ?? face.score ?? 0.86) * 100),
        box: createBox(bounds, video),
      })
    }

    return results
  }

  useEffect(() => {
    if (!isCameraActive) {
      setDetectedFaults([])
      return undefined
    }

    let activeStream
    let animationFrameId
    let lastDetectionTime = 0
    let isDetecting = false

    const runDetection = async (time) => {
      if (time - lastDetectionTime > 280 && !isDetecting) {
        isDetecting = true
        const results = await detectCameraFaults()
        setDetectedFaults(results)
        setCameraStatus(results.length > 0 ? 'Fault matched' : 'Scanning')
        lastDetectionTime = time
        isDetecting = false
      }

      animationFrameId = window.requestAnimationFrame(runDetection)
    }

    const startCamera = async () => {
      try {
        setCameraError('')
        setCameraStatus('Starting camera')

        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Camera access is not supported by this browser.')
          setIsCameraActive(false)
          return
        }

        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'user' },
          },
        })

        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = activeStream
          setCameraStatus('Loading AR detector')
          await loadDetectors()
          setCameraStatus('Scanning')
          animationFrameId = window.requestAnimationFrame(runDetection)
        }
      } catch {
        setCameraError(
          'Camera or AR detector access was blocked. Use localhost or HTTPS and allow camera permission.',
        )
        setCameraStatus('Unavailable')
        setIsCameraActive(false)
      }
    }

    startCamera()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      activeStream?.getTracks().forEach((track) => {
        track.stop()
      })

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null
      }

      handDetectorRef.current?.dispose?.()
      faceDetectorRef.current?.dispose?.()
      handDetectorRef.current = null
      faceDetectorRef.current = null
      setDetectedFaults([])
    }
  }, [dashboard.faults, isCameraActive])

  return (
    <section className="camera-workspace" aria-label="AR camera">
      <div className="dashboard-camera-panel camera-page-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AR Camera</p>
            <h1>Fault inspection feed</h1>
            <p className="camera-guidance">
              Demo detections link the camera feed to track signal fault, door
              sensor failure, and lighting outage.
            </p>
          </div>
          <button type="button" onClick={() => setIsCameraActive((active) => !active)}>
            {isCameraActive ? 'Stop camera' : 'Start camera'}
          </button>
        </div>

        <div className="camera-frame dashboard-camera-frame camera-page-frame">
          <video
            ref={cameraVideoRef}
            className="camera-video"
            autoPlay
            muted
            playsInline
            aria-label="Live AR camera preview"
          />
          <div className="scan-window camera-overlay" />
          {detectedFaults.map((fault) => (
            <div
              className={`detected-fault-box ${fault.severity}`}
              key={`${fault.id}-${fault.severity}`}
              style={fault.box}
            >
              <strong>{fault.title}</strong>
              <span>
                {fault.location} · {fault.confidence}% match
              </span>
              <span>{fault.trigger}</span>
            </div>
          ))}
          {isCameraActive && detectedFaults.length === 0 && cameraError.length === 0 && (
            <p className="camera-scan-status">{cameraStatus}</p>
          )}
          {cameraError.length > 0 && (
            <p className="camera-error" role="alert">
              {cameraError}
            </p>
          )}
        </div>

        <div className="camera-readout" aria-live="polite">
          <span>{cameraStateLabel}</span>
          <span>{detectionCountLabel}</span>
          <span>Track signal · door sensor · lighting outage</span>
        </div>
      </div>
    </section>
  )
}

function Dashboard({
  dashboard,
  fetchDashboard,
  lastUpdated,
  status,
  canDeleteFault,
  onDeleteFault,
}) {
  return (
    <section className="dashboard-workspace" aria-label="Dashboard">
      <aside className="dashboard-panel dashboard-page-panel" aria-label="Dashboard">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Public transport AR</p>
            <h1>Fault dashboard</h1>
          </div>
          <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>
        </div>

        <div className="dashboard-summary-grid">
          <div className="total-card">
            <span>Total faults</span>
            <strong>{dashboard.totalFaults}</strong>
          </div>

          <div className="severity-grid">
            <article className="severity-card high">
              <span>High</span>
              <strong>{dashboard.severityCount.high}</strong>
            </article>
            <article className="severity-card medium">
              <span>Medium</span>
              <strong>{dashboard.severityCount.medium}</strong>
            </article>
            <article className="severity-card low">
              <span>Low</span>
              <strong>{dashboard.severityCount.low}</strong>
            </article>
          </div>
        </div>

        <div className="fault-list">
          <div className="section-heading">
            <h2>Recent fault reports</h2>
            <button type="button" onClick={fetchDashboard}>
              Refresh
            </button>
          </div>

          {dashboard.faults.length > 0 ? (
            <ul>
              {dashboard.faults.slice(-4).map((fault, index) => (
                <li key={fault.id ?? `${fault.severity}-${index}`}>
                  <span className={`dot ${fault.severity ?? 'low'}`} />
                  <div>
                    <strong>{fault.title ?? fault.type ?? 'Reported fault'}</strong>
                    <p>
                      {fault.location ?? 'Unknown location'} - {fault.severity ?? 'low'}{' '}
                      severity
                    </p>
                  </div>
                  {canDeleteFault && (
                    <button
                      className="delete-fault-button"
                      type="button"
                      onClick={() => onDeleteFault(fault.id)}
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No live fault reports have been received yet.</p>
          )}
        </div>

        <p className="timestamp">
          {lastUpdated
            ? `Last synced ${lastUpdated.toLocaleTimeString()}`
            : 'Waiting for dashboard data'}
        </p>
      </aside>
    </section>
  )
}

export default Dashboard
