import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const developmentPort = Number(process.env.VITE_DEV_PORT || 5173);

export default defineConfig({
    plugins: [react()],
    server: {
		port: developmentPort,
        strictPort: true,
        host: "localhost",
        hmr: {
            protocol: "ws",
            host: "localhost",
			port: developmentPort,
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
