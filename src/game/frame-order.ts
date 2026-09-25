// The order things happen in each frame, as R3F `useFrame` priorities. Any
// positive priority means R3F leaves the drawing to us.

// The game simulation moves on.
export const STEP_PRIORITY = 1;

// Pieces of the world that follow me or the camera catch up.
export const FOLLOW_PRIORITY = 2;

// The frame is drawn.
export const RENDER_PRIORITY = 3;
