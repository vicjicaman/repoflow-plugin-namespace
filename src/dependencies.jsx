import fs from "fs";
import _ from "lodash";
import path from "path";
//import YAML from 'yamljs'
import { Operation, IO } from "@nebulario/core-plugin-request";
import * as Config from "@nebulario/core-config";
import * as JsonUtils from "@nebulario/core-json";
import * as Cluster from "@nebulario/core-cluster";

export const list = async (params, cxt) => {
  const {
    module: {
      fullname,
      code: {
        paths: {
          absolute: { folder }
        }
      }
    }
  } = params;

  const dependencies = await Cluster.Dependencies.list(params, cxt);

  return [...dependencies, ...Config.dependencies(folder)];
};

export const sync = async (params, cxt) => {
  const {
    module: {
      code: {
        paths: {
          absolute: { folder }
        }
      }
    },
    dependency: { kind, filename, path, version }
  } = params;

  if (kind === "config") {
    JsonUtils.sync(folder, {
      filename,
      path,
      version
    });
  } else {
    await Cluster.Dependencies.sync(params, cxt);
  }

  return {};
};
