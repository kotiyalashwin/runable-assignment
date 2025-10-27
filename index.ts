import Docker from "dockerode";
import express from "express";

const app = express();
app.use(express.json());
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

interface ContainerInfo {
	id: string;
	name: string;
	port: number;
	createdAt: number;
}
const activeContainers: Map<string, ContainerInfo> = new Map();
const ALLOWED_COMMANDS = ["ls", "cat", "pwd", "npm", "echo"];
const getRandomPort = (): number => 5000 + Math.floor(Math.random() * 1000);

app.post("/spawn", async (_, res) => {
	try {
		const TRAEFIK_NETWORK = "traefik_traefik-net";
		const port = getRandomPort();
		const containerName = `react-app-${Date.now()}`;
		const subdomain = `app-${Date.now()}.localhost`;
		const container = await docker.createContainer({
			Image: "react-base-image",
			ExposedPorts: { "5173/tcp": {} },
			Labels: {
				"traefik.enable": "true",
				[`traefik.http.routers.${containerName}.rule`]: `Host(\`${subdomain}\`)`,
				[`traefik.http.services.${containerName}.loadbalancer.server.port`]:
					"5173",
			},
			HostConfig: {
				NetworkMode: TRAEFIK_NETWORK,
			},
			NetworkingConfig: {
				EndpointsConfig: {
					[TRAEFIK_NETWORK]: {},
				},
			},
			Cmd: ["/compile_page.sh"],
		});
		await container.start();

		const id = container.id;
		activeContainers.set(id, {
			id,
			name: containerName,
			port,
			createdAt: Date.now(),
		});

		res.json({ id, preview: subdomain });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Failed to start container" });
	}
});

app.post("/stop/:id", async (req, res) => {
	const id = req.params.id;
	const containerInfo = activeContainers.get(id);

	if (!containerInfo) {
		return res.status(404).json({ error: "Container not found" });
	}

	try {
		const container = docker.getContainer(id);

		await container.stop().catch(() => {});

		await container.remove().catch(() => {});

		activeContainers.delete(id);

		res.json({ message: `Container ${id} stopped and removed successfully` });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Failed to stop/remove container" });
	}
});

app.post("/exec/:id", async (req, res) => {
	const containerId = req.params.id;
	const { command } = req.body;

	if (!containerId || !activeContainers.has(containerId)) {
		res.status(404).json({ error: "Container not found" });
		return;
	}
	const [cmd, ...args] = command.split(" ");
	if (!ALLOWED_COMMANDS.includes(cmd)) {
		return res.status(403).json({ error: "Command not allowed" });
	}

	try {
		const container = docker.getContainer(containerId);
		const exec = await container.exec({
			Cmd: [cmd, ...args],
			AttachStdout: true,
			AttachStderr: true,
		});

		const stream = await exec.start({});

		let output = "";
		stream.on("data", (chunk) => (output += chunk.toString()));
		stream.on("end", () => res.json({ output }));
	} catch (e) {
		console.log(e);
		res.status(500).json({ erro: "Something went wrong" });
	}
});

app.listen(3000, "0.0.0.0", () => console.log("Server running on port 3000"));
