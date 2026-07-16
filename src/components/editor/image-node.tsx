"use client";

import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  ElementFormatType,
} from "lexical";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionOutput,
} from "lexical";
import type { JSX } from "react";
import { ImageComponent } from "./image-component";

/** Normalized crop rectangle in image-space fractions (0–1). */
export type ImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SerializedImageNode = Spread<
  {
    altText: string;
    src: string;
    width?: number;
    height?: number;
    align?: ElementFormatType;
    crop?: ImageCrop;
  },
  SerializedLexicalNode
>;

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __width: number | undefined;
  __height: number | undefined;
  __align: ElementFormatType;
  __crop: ImageCrop | null;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__align,
      node.__crop,
      node.__key
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      width: serializedNode.width,
      height: serializedNode.height,
      align: serializedNode.align,
      crop: serializedNode.crop,
    });
  }

  exportJSON(): SerializedImageNode {
    return {
      altText: this.__altText,
      height: this.__height,
      src: this.__src,
      type: "image",
      version: 1,
      width: this.__width,
      align: this.__align,
      crop: this.__crop ?? undefined,
    };
  }

  constructor(
    src: string,
    altText: string,
    width?: number,
    height?: number,
    align: ElementFormatType = "left",
    crop: ImageCrop | null = null,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
    this.__height = height;
    this.__align = align;
    this.__crop = crop;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.className = "block max-w-full";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement("img");
    img.setAttribute("src", this.__src);
    img.setAttribute("alt", this.__altText);
    if (this.__width) img.setAttribute("width", String(this.__width));
    return { element: img };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: (domNode): DOMConversionOutput | null => {
          const img = domNode as HTMLImageElement;
          const node = $createImageNode({
            src: img.getAttribute("src") || "",
            altText: img.getAttribute("alt") || "",
            width: img.width || undefined,
          });
          return { node };
        },
        priority: 0,
      }),
    };
  }

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }

  getWidth(): number | undefined {
    return this.__width;
  }

  getHeight(): number | undefined {
    return this.__height;
  }

  getAlign(): ElementFormatType {
    return this.__align;
  }

  getCrop(): ImageCrop | null {
    return this.__crop;
  }

  setWidthAndHeight(width: number, height?: number): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  setAlign(align: ElementFormatType): void {
    const writable = this.getWritable();
    writable.__align = align;
  }

  setCrop(crop: ImageCrop | null): void {
    const writable = this.getWritable();
    writable.__crop = crop;
  }

  decorate(): JSX.Element {
    return (
      <ImageComponent
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        align={this.__align}
        crop={this.__crop}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createImageNode({
  src,
  altText,
  width,
  height,
  align,
  crop,
}: {
  src: string;
  altText: string;
  width?: number;
  height?: number;
  align?: ElementFormatType;
  crop?: ImageCrop;
}): ImageNode {
  return $applyNodeReplacement(
    new ImageNode(src, altText, width, height, align ?? "left", crop ?? null)
  );
}

export function $isImageNode(
  node: LexicalNode | null | undefined
): node is ImageNode {
  return node instanceof ImageNode;
}
