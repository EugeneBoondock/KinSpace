// Animated window-shadow overlay, ported from MessageCFO's SunlitCanopy.
// Renders wind-swayed leaf shadows + window-blind shadow bars + a warm light
// glow. Meant to sit ABOVE the therapy room's ambient image and below the chat
// content, so the still scenery picks up gentle, living light. Pure CSS/SVG
// driven (see `.sunlit-layer` rules in globals.css); no JS animation loop.

const SHUTTER_COUNT = 23

export function SunlitCanopy() {
  return (
    <div className="sunlit-layer" aria-hidden="true">
      <div className="sunlit-layer__glow" />
      <div className="sunlit-layer__glow-bounce" />

      <div className="sunlit-layer__perspective">
        <div
          className="sunlit-layer__leaves"
          style={{ backgroundImage: "url('/images/therapy/sunlit-leaves.png')" }}
        >
          <svg className="sunlit-layer__svg-defs">
            <defs>
              <filter id="sunlit-wind" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" numOctaves={2} seed={1}>
                  <animate
                    attributeName="baseFrequency"
                    dur="16s"
                    keyTimes="0;0.33;0.66;1"
                    values="0.005 0.003;0.01 0.009;0.008 0.004;0.005 0.003"
                    repeatCount="indefinite"
                  />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic">
                  <animate
                    attributeName="scale"
                    dur="20s"
                    keyTimes="0;0.25;0.5;0.75;1"
                    values="45;55;75;55;45"
                    repeatCount="indefinite"
                  />
                </feDisplacementMap>
              </filter>
            </defs>
          </svg>
        </div>

        <div className="sunlit-layer__blinds">
          <div className="sunlit-layer__shutters">
            {Array.from({ length: SHUTTER_COUNT }, (_, index) => (
              <div key={index} className="sunlit-layer__shutter" />
            ))}
          </div>
          <div className="sunlit-layer__vertical">
            <div className="sunlit-layer__bar" />
            <div className="sunlit-layer__bar" />
          </div>
        </div>
      </div>
    </div>
  )
}
