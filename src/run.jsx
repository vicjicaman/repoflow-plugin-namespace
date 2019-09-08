import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import YAML from 'yamljs';
import {
  spawn,
  wait,
  exec
} from '@nebulario/core-process';
import {
  IO
} from '@nebulario/core-plugin-request';


const modify = (folder, compFile, func) => {
  const inputPath = path.join(folder, "dist");
  const outputPath = path.join(folder, "tmp");

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }

  const srcFile = path.join(inputPath, compFile);
  const destFile = path.join(outputPath, compFile);

  const raw = fs.readFileSync(srcFile, "utf8");
  const content = YAML.parse(raw);
  const mod = func(content);

  fs.writeFileSync(destFile, YAML.stringify(mod, 10, 2), "utf8");
}

export const start = (params, cxt) => {

  IO.sendEvent("out", {
    data: JSON.stringify(params, null, 2)
  }, cxt);

  const {
    performer,
    performer: {
      type,
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    },
    feature: {
      featureid
    },
    instance: {
      paths: {
        absolute: {
          folder: instanceFolder
        }
      }
    }
  } = params;


  IO.sendEvent("out", {
    data: "Mounting instance... " + instanceFolder
  }, cxt);

  const mmot = spawn("minikube", ["mount", instanceFolder + ':/instance'], {
    onOutput: async function({
      data
    }) {
      IO.sendEvent("out", {
        data
      }, cxt);
    },
    onError: async ({
      data
    }) => {
      IO.sendEvent("error", {
        data
      }, cxt);
    }
  });

  mmot.promise.then(() => {
    IO.sendEvent("warning", {
      data: "Mounted"
    }, cxt);
  }).catch((err) => {
    IO.sendEvent("warning", {
      data: err.toString()
    }, cxt);
  });


  const watcher = async (operation, cxt) => {

    const {
      operationid
    } = operation;

    IO.sendEvent("out", {
      data: "Setting namespace config..."
    }, cxt);


    const namespacePath = path.join(folder, "dist", "namespace.yaml");
    const namespaceTmpPath = path.join(folder, "tmp", "namespace.yaml");

    modify(folder, "namespace.yaml", content => {
      content.metadata.name = featureid + "-" + content.metadata.name;
      return content;
    });

    const nsout = await exec(["kubectl apply -f " + namespaceTmpPath], {}, {}, cxt);

    IO.sendEvent("out", {
      data: nsout.stdout
    }, cxt);

    IO.sendEvent("out", {
      data: "Setting ingress config..."
    }, cxt);

    const ingressPath = path.join(folder, "dist", "ingress.yaml");
    const ingressTmpPath = path.join(folder, "tmp", "ingress.yaml");

    modify(folder, "ingress.yaml", content => {
      content.metadata.namespace = featureid + "-" + content.metadata.namespace;
      content.spec.rules = content.spec.rules.map(rule => {
        rule.host = featureid + "-" + rule.host;
        return rule;
      })
      return content;
    });

    const igosut = await exec(["kubectl apply -f " + ingressTmpPath], {}, {}, cxt);

    IO.sendEvent("out", {
      data: igosut.stdout
    }, cxt);

    while (operation.status !== "stopping") {
      await wait(2500);
    }

    IO.sendEvent("stopped", {
      operationid,
      data: "Stopping namespace config..."
    }, cxt);
  }


  return {
    promise: watcher,
    process: null
  };
}






/*

"dependencies": [
     {
       "dependencyid": "dependency|config.json|dependencies.microservice-config.version",
       "moduleid": "microservice-config",
       "kind": "config",
       "fullname": "github.com:*****microservice-config.git",
       "filename": "config.json",
       "path": "dependencies.microservice-config.version",
       "version": "file:./../microservice-config"
     },
     {
       "dependencyid": "dependency|config.json|dependencies.microservice-auth-config.version",
       "moduleid": "microservice-auth-config",
       "kind": "config",
       "fullname": "github.com:******microservice-auth-config.git",
       "filename": "config.json",
       "path": "dependencies.microservice-auth-config.version",
       "version": "file:./../microservice-auth-config"
     },
     {
       "dependencyid": "dependency|config.json|dependencies.microservice-auth-graph-config.version",
       "moduleid": "microservice-auth-graph-config",
       "kind": "config",
       "fullname": "github.com:******microservice-auth-graph-config.git",
       "filename": "config.json",
       "path": "dependencies.microservice-auth-graph-config.version",
       "version": "file:./../microservice-auth-graph-config"
     }
   ]
 },
 "dependents": [
   {
     "moduleid": "microservice-config"
   }
 ],
 "code": {
   "repositoryid": "/home/victor/repoflow/workspace/workspaces/microservices/instances/auth-service/modules/microservice-namespace",
   "paths": {
     "relative": {
       "base": "",
       "folder": "",
       "file": null
     },
     "absolute": {
       "base": "/home/victor/repoflow/workspace/workspaces/microservices/instances/auth-service/modules/microservice-namespace",
       "folder": "/home/victor/repoflow/workspace/workspaces/microservices/instances/auth-service/modules/microservice-namespace",
       "file": null
     }
   }
 },
 "output": {
   "paths": {
     "absolute": {
       "folder": "/home/victor/repoflow/workspace/workspaces/microservices/instances/auth-service/tasks/run/performers/microservice-namespace/output"
     }
   }
 },
 "labels": []
},
"baseline": {
 "baselineid": "master"
},
"feature": {
 "featureid": "auth-service"
},
"instance": {
 "instanceid": "auth-service",
 "paths": {
   "relative": {
     "base": "workspaces/microservices/instances",
     "folder": "workspaces/microservices/instances/auth-service",
     "file": "workspaces/microservices/instances/auth-service/instance.json"
   },
   "absolute": {
     "base": "/home/victor/repoflow/workspace/workspaces/microservices/instances",
     "folder": "/home/victor/repoflow/workspace/workspaces/microservices/instances/auth-service",
     "file": "/home/victor/repoflow/workspace/workspaces/microservices/instances/auth-service/instance.json"
   }
 }
}
*/
