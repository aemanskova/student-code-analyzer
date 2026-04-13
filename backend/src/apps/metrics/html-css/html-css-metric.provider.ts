import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as parse5 from 'parse5';
import * as csstree from 'css-tree';
import { DirectionMetricProvider, MetricComputeContext, MetricValues } from '../metrics.types';

@Injectable()
export class HtmlCssMetricProvider implements DirectionMetricProvider {
  readonly direction = 'html_css';
  readonly supportedMetrics = ['tag_count', 'css_specificity', 'unused_classes'];

  async computeSelected(
    context: MetricComputeContext,
    metrics: string[],
  ): Promise<MetricValues> {
    const htmlText = await fs.readFile(context.absolutePath, 'utf8');
    const htmlAst = parse5.parse(htmlText);

    const values: MetricValues = {};

    if (metrics.includes('tag_count')) {
      values.tag_count = this.countTags(htmlAst);
    }

    if (metrics.includes('css_specificity') || metrics.includes('unused_classes')) {
      const cssTexts = await this.collectCssTexts(context.absolutePath, htmlAst, htmlText);
      const selectorData = this.extractSelectorData(cssTexts);

      if (metrics.includes('css_specificity')) {
        values.css_specificity = selectorData.averageSpecificity;
      }

      if (metrics.includes('unused_classes')) {
        const usedClasses = this.extractHtmlClasses(htmlText);
        const uniqueSelectors = new Set(selectorData.classSelectors);
        const unused = Array.from(uniqueSelectors).filter((cssClass) => !usedClasses.has(cssClass));
        values.unused_classes = unused.length;
      }
    }

    return values;
  }

  private countTags(document: any): number {
    let count = 0;

    const walk = (node: any) => {
      if (node?.tagName) {
        count += 1;
      }
      const children = node?.childNodes || [];
      for (const child of children) {
        walk(child);
      }
    };

    walk(document);
    return count;
  }

  private async collectCssTexts(
    absoluteHtmlPath: string,
    document: any,
    htmlText: string,
  ): Promise<string[]> {
    const texts: string[] = [];

    const styleTexts = htmlText.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    for (const styleTag of styleTexts) {
      const content = styleTag.replace(/<style[^>]*>/i, '').replace(/<\/style>/i, '');
      texts.push(content);
    }

    const hrefs = this.extractStylesheetHrefs(document);
    for (const href of hrefs) {
      const filePath = path.resolve(path.dirname(absoluteHtmlPath), href);
      try {
        const css = await fs.readFile(filePath, 'utf8');
        texts.push(css);
      } catch {
        continue;
      }
    }

    return texts;
  }

  private extractStylesheetHrefs(document: any): string[] {
    const hrefs: string[] = [];

    const walk = (node: any) => {
      const element = node;
      if (element.tagName === 'link' && Array.isArray(element.attrs)) {
        const rel = element.attrs.find((attr: any) => attr.name === 'rel')?.value;
        const href = element.attrs.find((attr: any) => attr.name === 'href')?.value;
        if (rel?.toLowerCase() === 'stylesheet' && href && !href.startsWith('http')) {
          hrefs.push(href);
        }
      }

      const children = node?.childNodes || [];
      for (const child of children) {
        walk(child);
      }
    };

    walk(document);
    return hrefs;
  }

  private extractHtmlClasses(htmlText: string): Set<string> {
    const classes = new Set<string>();
    const classMatches = htmlText.match(/class\s*=\s*['\"]([^'\"]+)['\"]/gi) || [];

    for (const match of classMatches) {
      const values = match
        .replace(/class\s*=\s*['\"]/i, '')
        .replace(/['\"]$/, '')
        .split(/\s+/)
        .filter(Boolean);
      for (const value of values) {
        classes.add(value.trim());
      }
    }

    return classes;
  }

  private extractSelectorData(cssTexts: string[]): {
    averageSpecificity: number;
    classSelectors: string[];
  } {
    const specificityValues: number[] = [];
    const classSelectors: string[] = [];

    for (const cssText of cssTexts) {
      let ast: any;
      try {
        ast = (csstree as any).parse(cssText, {
          parseRulePrelude: true,
          parseValue: false,
        });
      } catch {
        continue;
      }

      (csstree as any).walk(ast, {
        visit: 'Rule',
        enter: (node: any) => {
          if (node.type !== 'Rule' || !node.prelude || node.prelude.type !== 'SelectorList') {
            return;
          }

          node.prelude.children.forEach((selectorNode: any) => {
            const value = this.selectorSpecificity(selectorNode);
            specificityValues.push(value);

            (csstree as any).walk(selectorNode, {
              enter: (child: any) => {
                if (child.type === 'ClassSelector') {
                  classSelectors.push(String(child.name));
                }
              },
            });
          });
        },
      });
    }

    const averageSpecificity =
      specificityValues.length > 0
        ? Number(
            (
              specificityValues.reduce((acc, current) => acc + current, 0) /
              specificityValues.length
            ).toFixed(3),
          )
        : 0;

    return { averageSpecificity, classSelectors };
  }

  private selectorSpecificity(selectorNode: any): number {
    let a = 0;
    let b = 0;
    let c = 0;

    (csstree as any).walk(selectorNode, {
      enter: (node: any) => {
        if (node.type === 'IdSelector') {
          a += 1;
          return;
        }
        if (
          node.type === 'ClassSelector' ||
          node.type === 'AttributeSelector' ||
          node.type === 'PseudoClassSelector'
        ) {
          b += 1;
          return;
        }
        if (node.type === 'TypeSelector' || node.type === 'PseudoElementSelector') {
          c += 1;
        }
      },
    });

    return a * 100 + b * 10 + c;
  }
}
