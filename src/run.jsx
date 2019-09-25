import _ from "lodash";
import fs from "fs-extra";
import path from "path";
import YAML from "yamljs";
import { spawn, wait, exec } from "@nebulario/core-process";
import { execSync } from "child_process";
import { IO } from "@nebulario/core-plugin-request";
import * as Cluster from "@nebulario/core-cluster";

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


    if (command === "init" || command.indexOf("full") > -1) {
      for (const plugin of plugins) {
        const { pluginid, home } = plugin;
        if (pluginid.startsWith("agent:")) {
          const [agent, type] = pluginid.split(":");

          IO.sendEvent(
            "info",
            {
              data: "Initialize container agent... " + type
            },
            cxt
          );

          const targetFolder = "/home/docker/agent/" + instanceid + "/" + type;
          await Cluster.Minikube.copyToHost(
            { path: home, type: "folder" },
            targetFolder,
            cxt
          );
        }
      }
    }

    IO.sendEvent(
      "out",
      {
        data: "Setting namespace config..."
      },
      cxt
    );

    const distPath = path.join(folder, "dist");
    const tmpPath = path.join(folder, "tmp");

    const namespaceDevFile = await Cluster.Dev.transform(
      "namespace.yaml",
      distPath,
      tmpPath,
      async content => {
        content.metadata.name = instanceid + "-" + content.metadata.name;
        return content;
      }
    );

    const nsout = await Cluster.Control.apply(namespaceDevFile, cxt);
    IO.sendOutput(nsout, cxt);

    const ingressDevFile = await Cluster.Dev.transform(
      "ingress.yaml",
      distPath,
      tmpPath,
      async content => {
        content.metadata.namespace =
          instanceid + "-" + content.metadata.namespace;
        content.spec.rules = content.spec.rules.map(rule => {
          rule.host = instanceid + "-" + rule.host;
          return rule;
        });
        return content;
      }
    );

    const igsout = await Cluster.Control.apply(ingressDevFile, cxt);
    IO.sendOutput(igsout, cxt);

    IO.sendEvent(
      "info",
      {
        data: "Namespace & Ingress up to date..."
      },
      cxt
    );

    IO.sendEvent("done", {}, cxt);

    while (operation.status !== "stopping") {
      await wait(100); //wait(2500);
    }
  };

  return {
    promise: startOp,
    process: null
  };
};
