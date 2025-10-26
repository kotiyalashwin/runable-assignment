import express from "express";
import Docker from "dockerode";

const app = express();
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

interface ContainerInfo {
  id: string;
  name: string;
  port: number;
  createdAt: number;
}
const activeContainers: Map<string, ContainerInfo> = new Map();

const getRandomPort = (): number => 5000 + Math.floor(Math.random() * 1000);

app.post("/spawn", async (req, res) => {
  try {
    const port = getRandomPort();
    const containerName = `react-app-${Date.now()}`;
        const subdomain = `app-${Date.now()}.localhost`;
const container = await docker.createContainer({
    Image: "react-sandbox",
    ExposedPorts: { "5173/tcp": {} },
    Labels: {
      "traefik.enable": "true",
      [`traefik.http.routers.${containerName}.rule`]: `Host(\`${subdomain}\`)`,
      [`traefik.http.services.${containerName}.loadbalancer.server.port`]: "5173",
    },
    Cmd : ["/compile_page.sh"]
  });
    await container.start();

    const id = container.id; // unique ID for this container
    activeContainers.set(id, { id, name: containerName, port, createdAt: Date.now() });

    // Return a clean URL
    const url = `http://localhost:${port}`;
    res.json({ id, subdomain });
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

app.listen(8080, () => console.log("Server running on port 8080"));
