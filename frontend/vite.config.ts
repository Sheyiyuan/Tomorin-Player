import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const developmentPort = Number(process.env.VITE_DEV_PORT || 5173);

export default defineConfig({
    plugins: [react()],
    server: {
		port: developmentPort,
		// Wails discovers the URL from Vite's startup output. Allow Vite to
		// move to the next free port when the preferred port is occupied.
        strictPort: false,
        host: "localhost",
        hmr: {
            protocol: "ws",
            host: "localhost",
        },
        watch: {
            usePolling: true,
        },
    },
    build: {
        outDir: "dist",
        sourcemap: true,
    },
});
