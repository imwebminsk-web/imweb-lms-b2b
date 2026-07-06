module.exports = {
  apps: [
    {
      name: "newedy",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: "max",
      exec_mode: "cluster",
      env: {
        PORT: 3000,
        NODE_ENV: "production",
      },
      env_file: ".env.local",
    },
  ],
};
