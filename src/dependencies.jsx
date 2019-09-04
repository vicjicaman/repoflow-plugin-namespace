import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import {
  Operation,
  IO
} from '@nebulario/core-plugin-request';
import * as Config from '@nebulario/core-config';
import * as JsonUtils from '@nebulario/core-json'

export const list = async ({
  module: {
    fullname,
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  }
}, cxt) => {


  //const ingress = JsonUtils.load(folder + "/ingress.yaml", true);

  const deps = []; /*ingress.spec.rules.reduce((res, {
    host,
    http: {
      paths
    }
  }, hi) => {

    const pathdeps = paths.map(({
      path,
      backend: {
        serviceName
      }
    }, pi) => ({
      dependencyid: 'service|ingress.yaml|spec.rules[' + hi + '].http.paths[' + pi + '].' + serviceName,
      kind: "service",
      filename: "ingress.yaml",
      path: 'spec.rules[' + hi + '].http.paths[' + pi + '].' + serviceName,
      fullname: serviceName,
      version: "-"
    }))


    return [...res, ...pathdeps]

  }, []);*/

  return [...deps, ...Config.dependencies(folder)];
}

export const sync = async ({
  module: {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  },
  dependency: {
    kind,
    filename,
    path,
    version
  }
}, cxt) => {

  if (version) {
    JsonUtils.sync(folder, {
      filename,
      path,
      version
    });
  }

  return {};
}
