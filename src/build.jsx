import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import YAML from 'yamljs';
import {
  exec,
  spawn,
  wait
} from '@nebulario/core-process';
import {
  Operation,
  IO,
  Watcher
} from '@nebulario/core-plugin-request';

import * as Config from '@nebulario/core-config';
import * as JsonUtils from '@nebulario/core-json'



export const clear = async (params, cxt) => {

  const {
    performer: {
      type,
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  try {
    await Config.clear(folder);
  } catch (e) {
    IO.sendEvent("error", {
      data: e.toString()
    }, cxt);
    throw e;
  }

  return "Configuration cleared";
}



export const init = async (params, cxt) => {

  const {
    performer: {
      type,
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  try {
    await Config.init(folder);
  } catch (e) {
    IO.sendEvent("error", {
      data: e.toString()
    }, cxt);
    throw e;
  }

  return "Config namespace initialized";
}

export const start = (params, cxt) => {

  const {
    performer: {
      type,
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    }
  } = params;

  if (type !== "instanced") {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }


  const configPath = path.join(folder, "config.json");
  const namespacePath = path.join(folder, "namespace.yaml");
  const ingressPath = path.join(folder, "ingress.yaml");


  const watcher = async (operation, cxt) => {

    const {
      operationid
    } = operation;

    await wait(100);

    IO.sendEvent("out", {
      operationid,
      data: "Watching config changes for " + configPath
    }, cxt);

    await build(operation, params, cxt);

    const watcherConfig = Watcher.watch(configPath, () => {
      IO.sendEvent("out", {
        operationid,
        data: "config.json changed..."
      }, cxt);
      build(operation, params, cxt);
    });
    const watcherNamespace = Watcher.watch(namespacePath, () => {
      IO.sendEvent("out", {
        operationid,
        data: "namespace.yaml changed..."
      }, cxt);
      build(operation, params, cxt);
    });
    const watcherIngress = Watcher.watch(ingressPath, () => {
      IO.sendEvent("out", {
        operationid,
        data: "ingress.yaml changed..."
      }, cxt);
      build(operation, params, cxt);
    });


    while (operation.status !== "stopping") {
      await wait(2500);
    }

    watcherConfig.close();
    watcherIngress.close();
    watcherNamespace.close();
    await wait(100);

    IO.sendEvent("stopped", {
      operationid,
      data: ""
    }, cxt);
  }


  return {
    promise: watcher,
    process: null
  };
}




const build = (operation, params, cxt) => {

  const {
    performer: {
      type,
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    }
  } = params;

  const {
    operationid
  } = operation;

  try {

    IO.sendEvent("out", {
      operationid,
      data: "Start building config..."
    }, cxt);

    Config.build(folder);

    IO.sendEvent("done", {
      operationid,
      data: "Config generated: dist/config.json"
    }, cxt);


    const config = JsonUtils.load(path.join(folder, "config.json"));
    const values = Config.values(folder, config);

    const filesToCopy = ["ingress.yaml", "namespace.yaml"];
    const outputPath = path.join(folder, "dist");

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath);
    }

    for (const compFile of filesToCopy) {
      const srcFile = path.join(folder, compFile);
      const destFile = path.join(outputPath, compFile);

      const raw = fs.readFileSync(srcFile, "utf8");
      const convert = Config.replace(raw, values);
      fs.writeFileSync(destFile, convert, "utf8");
    }


    IO.sendEvent("done", {
      operationid,
      data: JSON.stringify(values, null, 2)
    }, cxt);


  } catch (e) {
    IO.sendEvent("error", {
      operationid,
      data: e.toString()
    }, cxt);
  }

}
