import _ from "lodash";
import fs from "fs-extra";
import path from "path";
import YAML from "yamljs";
import { exec, spawn, wait } from "@nebulario/core-process";
import {
  Operation,
  IO,
  Watcher,
  Performer
} from "@nebulario/core-plugin-request";
import * as Config from "@nebulario/core-config";
import * as Cluster from "@nebulario/core-cluster";
import * as JsonUtils from "@nebulario/core-json";
import { isFile, getFiles } from "./utils";

const configFolder = (base, src, dest, values, cxt) => {
  const srcBase = path.join(src, base);
  const destBase = path.join(dest, base);
  const list = getFiles(srcBase, "yaml");

  for (const vPath of list) {
    const file = path.basename(vPath);
    IO.sendEvent(
      "info",
      {
        data: "Configure " + base + " - " + file
      },
      cxt
    );

    Cluster.Config.configure(file, srcBase, destBase, values);
  }
};

export const clear = async (params, cxt) => {
  const {
    performer: {
      type,
      code: {
        paths: {
          absolute: { folder }
        }
      }
    }
  } = params;

  if (type === "instanced") {
    await Config.clear(folder);
  }
};

export const init = async (params, cxt) => {
  const {
    performers,
    performer,
    performer: {
      dependents,
      type,
      code: {
        paths: {
          absolute: { folder }
        }
      }
    }
  } = params;

  if (type === "instanced") {
    Performer.link(performer, performers, {
      onLinked: depPerformer => {
        if (depPerformer.module.type === "config") {
          IO.sendEvent(
            "info",
            {
              data: depPerformer.performerid + " config linked!"
            },
            cxt
          );

          Config.link(folder, depPerformer.performerid);
        }
      }
    });
    await Config.init(folder);
  }
};

export const start = (params, cxt) => {
  const {
    performers,
    performer,
    performer: {
      dependents,
      type,
      code: {
        paths: {
          absolute: { folder }
        }
      }
    }
  } = params;

  if (type === "instanced") {
    const configPath = path.join(folder, "config.json");
    const servicePath = path.join(folder, "namespace.yaml");
    const deploymentPath = path.join(folder, "ingress.yaml");

    Performer.sendLinkStateEvents(performer, performers, cxt);

    const startOp = async (operation, cxt) => {
      const { operationid } = operation;

      build(operation, params, cxt);

      const watchers = Watcher.multiple(
        [configPath, servicePath, deploymentPath],
        changedPath => {
          IO.sendEvent(
            "warning",
            {
              data: changedPath + " changed..."
            },
            cxt
          );
          build(operation, params, cxt);
        }
      );

      while (operation.status !== "stopping") {
        await wait(100); //wait(2500);
      }

      Watcher.stop(watchers);

      /*IO.sendEvent(
        "stopped",
        {
          operationid,
          data: ""
        },
        cxt
      );*/
    };

    return {
      promise: startOp,
      process: null
    };
  }
};

const build = (operation, params, cxt) => {
  const {
    performer: {
      type,
      code: {
        paths: {
          absolute: { folder }
        }
      }
    }
  } = params;

  const { operationid } = operation;

  try {
    IO.sendEvent(
      "out",
      {
        operationid,
        data: "Start building config..."
      },
      cxt
    );

    Config.build(folder);
    const values = Config.load(folder);

    const src = path.join(folder, "");
    const dest = path.join(folder, "dist");

    Cluster.Config.configure("namespace.yaml", src, dest, values);
    Cluster.Config.configure("ingress.yaml", src, dest, values);

    IO.sendEvent(
      "out",
      {
        data: "Namespace & ingress generated!"
      },
      cxt
    );

    configFolder("secrets", src, dest, values);
    configFolder("volumes", src, dest, values);
    configFolder("storages", src, dest, values);

    IO.sendEvent(
      "done",
      {
        data: "Namespace build!"
      },
      cxt
    );
  } catch (e) {
    IO.sendEvent(
      "error",
      {
        operationid,
        data: e.toString()
      },
      cxt
    );
  }
};
