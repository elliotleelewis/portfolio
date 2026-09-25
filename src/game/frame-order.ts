// The order things happen in each frame, as R3F `useFrame` priorities. Any
// positive priority means R3F leaves the drawing to us.

// The game moves on (running its systems in their own order: see
// SYSTEM_ORDER).
export const STEP_PRIORITY = 1;

// The frame is drawn.
export const RENDER_PRIORITY = 2;
