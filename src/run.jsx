import _ from "lodash";
import fs from "fs-extra";
import path from "path";
import YAML from "yamljs";
import { spawn, wait, exec } from "@nebulario/core-process";
import { execSync } from "child_process";
import { IO } from "@nebulario/core-plugin-request";
import * as Cluster from "@nebulario/core-cluster";
import * as JsonUtils from "@nebulario/core-json";

import { isFile, getFiles } from "./utils";

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


};

const runSecrets = async (params, cxt) => {
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

  IO.sendEvent(
    "info",
    {
      data: "Create secrets... " + type
    },
    cxt
  );

  const tmpPath = path.join(folder, "tmp", "secrets");
  const distPath = path.join(folder, "dist", "secrets");
  const { cluster } = params.config;
  const list = getFiles(distPath, "yaml");

  for (const secretPath of list) {
    const file = path.basename(secretPath);
    IO.sendEvent(
      "info",
      {
        data: "Secrets... " + file
      },
      cxt
    );

    const rootPath = path.join(
      cluster.root,
      "secrets",
      file.replace(".yaml", "") + ".json"
    );

    if (fs.existsSync(rootPath)) {
      const secretDevFile = await Cluster.Dev.transform(
        file,
        distPath,
        tmpPath,
        async content => {
          if (cluster) {
            const actualSecret = JsonUtils.load(rootPath);

            for (const dv in content.data) {
              if (actualSecret[dv]) {
                content.data[dv] = Buffer.from(actualSecret[dv]).toString(
                  "base64"
                );
              }
            }
          }

          content.metadata.namespace =
            instanceid + "-" + content.metadata.namespace;

          return content;
        }
      );

      const nsout = await Cluster.Control.apply(secretDevFile, cxt);
      IO.sendOutput(nsout, cxt);
    }
  }
};

const runVolumes = async (params, cxt) => {
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

  IO.sendEvent(
    "info",
    {
      data: "Create volumes... " + type
    },
    cxt
  );

  const tmpPath = path.join(folder, "tmp", "volumes");
  const distPath = path.join(folder, "dist", "volumes");
  const { cluster } = params.config;
  const list = getFiles(distPath, "yaml");

  for (const volPath of list) {
    const file = path.basename(volPath);
    IO.sendEvent(
      "info",
      {
        data: "Volumes... " + file
      },
      cxt
    );

    const currVol = JsonUtils.load(volPath, true);

    const rootPath = path.join(
      cluster.root,
      "volumes",
      currVol.spec.awsElasticBlockStore.volumeID
    );

    if (fs.existsSync(rootPath)) {
      // COPY TO MINIKUBE HOST
    }
    const localDevFile = await Cluster.Dev.transform(
      file,
      distPath,
      tmpPath,
      async content => {
        content.metadata.namespace =
          instanceid + "-" + content.metadata.namespace;

        content.spec.storageClassName = "local-storage";
        content.spec.capacity.storage = "50Mi";
        content.spec.hostPath = {
          path: path.join(
            "/volumes",
            instanceid,
            currVol.spec.awsElasticBlockStore.volumeID
          )
        };
        if (content.spec.awsElasticBlockStore) {
          delete content.spec.awsElasticBlockStore;
        }
        /*
nodeAffinity:
  required:
    nodeSelectorTerms:
    - matchExpressions:
      - key: kubernetes.io/hostname
        operator: In
        values:
        - minikube
*/
        /*


          spec:
                storageClassName: local-storage
                accessModes:
                  - ReadWriteOnce
                capacity:
                  storage: 50Mi
                hostPath:
                  path: /data/` +
                  instanceid +
                  `/` +
                  performerid +
                  `/
                nodeAffinity:
                  required:
                    nodeSelectorTerms:
                    - matchExpressions:
                      - key: kubernetes.io/hostname
                        operator: In
                        values:
                        - minikube


          apiVersion: "v1"
          kind: "PersistentVolume"
          metadata:
            name: certificates
            namespace: ${NAMESPACE@microservice-config}
            labels:
              service: certificate
          spec:
            storageClassName: standard
            capacity:
              storage: "1Gi"
            accessModes:
              - "ReadWriteOnce"
            awsElasticBlockStore:
              fsType: "ext4"
              volumeID: "vol-0572afea6012336e3"
          */

        return content;
      }
    );

    const nsout = await Cluster.Control.apply(localDevFile, cxt);
    IO.sendOutput(nsout, cxt);
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

        for (const rule of content.spec.rules) {
          const { host } = rule;

          IO.sendEvent(
            "out",
            {
              data: "Add " + host + " namespace to local /etc/hosts..."
            },
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

        return content;
      }
    );

    const igsout = await Cluster.Control.apply(ingressDevFile, cxt);
    IO.sendOutput(igsout, cxt);

    await runSecrets(params, cxt);
    await runVolumes(params, cxt);

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
