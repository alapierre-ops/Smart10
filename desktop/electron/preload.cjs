const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("smart10", {
  version: "0.1.0"
});
