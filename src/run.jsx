import _ from "lodash";
import fs from "fs-extra";
import path from "path";
import YAML from "yamljs";
import { spawn, wait, exec } from "@nebulario/core-process";
import { execSync } from "child_process";
import { IO } from "@nebulario/core-plugin-request";
import * as Cluster from "@nebulario/core-cluster";
import * as JsonUtils from "@nebulario/core-json";

export const init = async (params, cxt) => {
  const {
    performers,
    performer,
    instance: {
      instanceid,
      paths: {
        absolute: { folder: instanceFolder }
      }
    },
    performer: {
      dependents,
      type,
      code: {
        paths: {
          absolute: { folder }
        }
      }
    },
    plugins
  } = params;

  for (const plugin of plugins) {
    const { pluginid, home } = plugin;
    if (pluginid.startsWith("agent:")) {
      const [agent, type] = pluginid.split(":");

      IO.print("info", "Initialize container agent... " + type, cxt);

      const targetFolder = "/home/docker/agent/" + instanceid + "/" + type;
      await Cluster.Minikube.copyToHost(
        { path: home, type: "folder" },
        targetFolder,
        {},
        cxt
      );
    }
  }
};

export const start = (params, cxt) => {
  const {
    command,
    performers,
    performer,
    performer: {
      type,
      code: {
        paths: {
          absolute: { folder }
        }
      }
    },
    instance: {
      instanceid,
      paths: {
        absolute: { folder: instanceFolder }
      }
    },
    plugins
  } = params;

  const startOp = async (operation, cxt) => {
    IO.print("out", "Setting namespace config...", cxt);

    const res = await Cluster.Tasks.Run.exec(
      folder,
      {
        handlers: {
          onError: async ({ type, file }, e, cxt) => {
            IO.print("warning", type + " " + file + "  " + e.toString(), cxt);
          },
          onCompleted: async ({ type, file }, res, cxt) => {
            IO.print("info", type + " " + file + " completed", cxt);
            IO.print("out", res.stdout, cxt);
            IO.print("warning", res.strerr, cxt);
          },
          entities: {}
        }
      },
      {},
      cxt
    );

    for (const ing of res.entities["ingress"]) {
      const {
        file,
        paths: { tmp },
        error
      } = ing;

      if (error) {
        continue;
      }

      const content = JsonUtils.load(path.join(tmp, file), true);

      for (const rule of content.spec.rules) {
        const { host } = rule;

        IO.print(
          "out",
          "Add " + host + " namespace to local /etc/hosts...",
          cxt
        );

        await Cluster.Control.exec(
          [],
          async ([], innerClusterContext, cxt) => {
            const line = "127.0.0.1 " + host;
            const file = "/etc/hosts";

            return await innerClusterContext(
              `grep -qF -- "${line}" "${file}" || echo "${line}" >> "${file}"`,
              {},
              cxt
            );
          },
          {},
          cxt
        );
      }
    }

    IO.print("done", "Namespace & Ingress up to date...", cxt);

    while (operation.status !== "stopping") {
      await wait(100);
    }
  };

  return {
    promise: startOp,
    process: null
  };
};
