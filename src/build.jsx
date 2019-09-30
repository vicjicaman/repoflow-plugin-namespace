import _ from "lodash";
import fs from "fs-extra";
import path from "path";
import YAML from "yamljs";
import { exec, spawn, wait } from "@nebulario/core-process";
import { Operation, IO, Watcher } from "@nebulario/core-plugin-request";
import * as Config from "@nebulario/core-config";
import * as Cluster from "@nebulario/core-cluster";
import * as JsonUtils from "@nebulario/core-json";
import * as Performer from "@nebulario/core-performer";

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
    Performer.linked(performer, performers)
      .filter(({ module: { type } }) => type === "config")
      .forEach(({ performerid }) => {
        IO.print("info", performerid + " config linked!", cxt);
        Config.link(folder, performerid);
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
    const startOp = async (operation, cxt) => {

      await build(params, cxt);
      /*const watchers = Watcher.multiple(
        ["config.json", "entities/*"],
        changedPath => {
          IO.print("warning", changedPath + " changed...", cxt);
          build(params, cxt);
        }
      );*/

      while (operation.status !== "stopping") {
        await wait(100);
      }

      //Watcher.stop(watchers);
    };

    return {
      promise: startOp,
      process: null
    };
  }
};

const build = async (params, cxt) => {
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

  try {
    IO.print("out", "Start building config...", cxt);
    Config.build(folder);
    const values = Config.load(folder);

    await Cluster.Tasks.Build.exec(folder, values, {}, cxt);

    IO.print("done", "Namespace build!", cxt);
  } catch (e) {
    IO.print("error", e.toString(), cxt);
  }
};
