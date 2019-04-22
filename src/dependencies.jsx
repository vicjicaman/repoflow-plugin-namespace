import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import {Operation, IO, Config, JSON} from '@nebulario/core-plugin-request';

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
  const {pluginid} = cxt;
  return Config.dependencies(folder);
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
    JSON.sync(folder, {
      filename,
      path,
      version
    });
  }

  return {};
}
