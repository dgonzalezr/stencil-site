import marked from 'marked';
import Prism from 'prismjs';
import path from 'path';
import loadLanguages from 'prismjs/components/';
import { SiteStructureItem, MarkdownContent } from '../src/global/definitions';

const languages = ['jsx', 'html', 'js', 'ts', 'tsx', 'bash', 'typescript', 'javascript', 'markup', 'css', 'json', 'diff'];
loadLanguages(languages);

export function findItem(siteStructureList: SiteStructureItem[], filePath: string): SiteStructureItem {
  for (const item of siteStructureList) {
    if (item.filePath === filePath) {
      return item;
    } else if (item.children && item.children.length > 0) {
      const foundItem = findItem(item.children, filePath);
      if (foundItem != null) {
        return foundItem;
      }
    }
  }
}

export function listFactory(renderer: marked.Renderer, metadataList: SiteStructureItem[]) {
  let lastItem: any = null;
  let activeList = [];
  const prevList = renderer.list;
  const prevListitem = renderer.listitem;
  const prevLink = renderer.link;

  renderer.list = function (body, ordered) {
    lastItem = {
      type: 'list',
    };
    return prevList.call(this, body, ordered);
  };
  renderer.listitem = function (text) {
    if (lastItem.type === 'list') {
      const [itemText] = text.split('<ul');
      lastItem = {
        type: 'listitem',
        text: itemText,
        children: activeList,
      };
      metadataList.push({
        text: itemText,
        children: activeList,
      });
      activeList = [];
    } else if (lastItem.type === 'link') {
      lastItem = {
        type: 'listitem',
        text: lastItem.text,
        filePath: lastItem.filePath,
      };
      activeList.push({
        text: lastItem.text,
        filePath: lastItem.filePath,
      });
    } else {
      lastItem = {
        type: 'listitem',
        text: text,
      };
      activeList.push({
        text,
      });
    }
    return prevListitem.call(this, text);
  };
  renderer.link = function (href: string, title: string, text: string) {
    lastItem = {
      type: 'link',
      text,
      filePath: href,
    };
    return prevLink.call(this, href, title, text);
  };
}

export function localizeMarkdownLink(renderer: marked.Renderer, filePath: string, metadataList: SiteStructureItem[]) {
  const prevLink = renderer.link;

  renderer.link = function (href: string, title: string, text: string) {
    if (!(href.startsWith('/') || href.startsWith('#') || href.startsWith('http'))) {
      let [pathname, fragment] = href.split('#');
      fragment = fragment ? `#${fragment}` : '';
      const newPath = path.resolve(path.dirname(filePath), pathname) + '.json';
      const item = findItem(metadataList, newPath);
      if (item && item.url != null) {
        return `<stencil-route-link ${title ? `anchorTitle=${title}` : ''} url=${item.url}${fragment}>${text}</stencil-route-link>`;
      }
    }
    return prevLink.call(this, href, title, text);
  };
}

export function collectHeadingMetadata(renderer: marked.Renderer, metadata: MarkdownContent) {
  renderer.heading = function (text, level, raw) {
    let id = raw.toLowerCase().replace(/[^\w]+/g, '-');

    while (id.startsWith('-')) {
      id = id.substring(1);
    }
    while (id.endsWith('-')) {
      id = id.substring(0, id.length - 1);
    }

    metadata.headings.push({
      id,
      level,
      text,
    });

    return `
<h${level} id="${id}">
  ${level !== 1 ? `<a class="heading-link" href="#${id}"><app-icon name="link"></app-icon>` : ''}
  ${text}
  ${level !== 1 ? `</a>` : ''}
</h${level}>
`;
  };
}

export function changeCodeCreation(renderer: marked.Renderer) {
  function highlight(code: string, lang?: string) {
    if (lang != null && languages.indexOf(lang) !== -1) {
      return Prism.highlight(code, Prism.languages[lang], lang);
    }
    return code;
  }

  renderer.code = function (code, lang, escaped) {
    const out = highlight(code, lang);

    if (out != null) {
      escaped = true;
      code = out;
    }

    if (!lang) {
      return `
  <highlight-code>
    <pre><code>${escaped ? code : escape(code)}</code></pre>
  </highlight-code>
      `;
    }

    return `
  <highlight-code>
    <pre class="language-${escape(lang)}"><code class="language-${escape(lang)}">${escaped ? code : escape(code)}</code></pre>
  </highlight-code>
  `;
  };
}
