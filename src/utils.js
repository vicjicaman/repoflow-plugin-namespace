import fs from "fs-extra";
import path from "path";

export const isFile = source => fs.lstatSync(source).isFile();
export const getFiles = (source, ext) => {
  if (!fs.existsSync(source)) {
    return [];
  }

  return fs
    .readdirSync(source)
    .map(name => path.join(source, name))
    .filter(isFile)
    .filter(source => source.endsWith(ext));
};
