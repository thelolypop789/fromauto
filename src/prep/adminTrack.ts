import { createContext, useContext } from "react";

// Which exam track the admin analytics show: null = everyone, "obec" = สพฐ., "vec" = สอศ. Passed to the RPCs as p_track.
export type AdminTrack = null | "obec" | "vec";
export const AdminTrackContext = createContext<AdminTrack>(null);
export const useAdminTrack = () => useContext(AdminTrackContext);
