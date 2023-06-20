---
title: Pinelab Vendure Plugins
description: Battle tested plugins for the Vendure e-commerce framework, built by Pinelab
template: splash
hero:
  title: Battle tested Vendure plugins
  tagline: Plugins for vendure, built by Pinelab, used for solving real life problems for our clients.
  image:
    file: ../../../public/silver-partner.svg
  actions:
    - text: How it works
      link: /guides/example/
      icon: right-arrow
      variant: primary
    - text: Read the Starlight docs
      link: https://starlight.astro.build
      icon: external
---

import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { Prism } from '@astrojs/prism';
import \* as marked from 'marked';
import {Content as Template} from './plugin-template.mdx';
import { fileURLToPath } from 'url';
export async function getStaticPaths() {
const **filename = fileURLToPath(import.meta.url);
const **dirname = path.dirname(**filename);
const packagesDirRelativeLocation = '../../../../packages';
const getDirectories = async (source: string) =>
(await readdir(path.join(**dirname, source), { withFileTypes: true }))
.filter((dirent) => dirent.isDirectory())
.map((dirent) => dirent.name);
const response = await getDirectories(packagesDirRelativeLocation);
return response.map((f) => {
return { params: { fileName: f } };
});
}
