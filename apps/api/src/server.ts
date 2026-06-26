import Fastify from "fastify";

const app = Fastify();

app.get("/health", async () => {
    return {
        status: "ok",
        service: "appbit-api",
    };
});

app.listen({
    port: 4000,
});