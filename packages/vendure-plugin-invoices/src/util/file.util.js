'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.createTempFile = createTempFile;
exports.exists = exists;
exports.safeRemove = safeRemove;
exports.zipFiles = zipFiles;
const core_1 = require('@vendure/core');
const promises_1 = __importDefault(require('fs/promises'));
const tmp = __importStar(require('tmp'));
const constants_1 = require('../constants');
/* eslint-disable @typescript-eslint/no-require-imports */
const AdmZip = require('adm-zip');
async function createTempFile(postfix) {
  return new Promise((resolve, reject) => {
    tmp.file({ postfix }, (err, path) => {
      if (err) {
        reject(err);
      } else {
        resolve(path);
      }
    });
  });
}
async function exists(path) {
  let exists = false;
  try {
    await promises_1.default.access(path);
    exists = true;
  } catch {
    exists = false;
  }
  return exists;
}
/**
 * Attempt deletion of file, but swallow any errors.
 */
function safeRemove(path) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promises_1.default.unlink(path).catch((err) => {
    core_1.Logger.error(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      `Could not remove file ${path}: ${err?.message}`,
      constants_1.loggerCtx,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      JSON.stringify(err?.stack)
    );
  });
}
async function zipFiles(files) {
  const zip = new AdmZip();
  for (const file of files) {
    zip.addLocalFile(file.path, undefined, file.name);
  }
  const tmpFilePath = await createTempFile('.zip');
  zip.writeZip(tmpFilePath);
  return tmpFilePath;
}
