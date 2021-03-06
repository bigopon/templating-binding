import { Binding, bindingMode, connectable, enqueueBindingConnect, Expression, ObserverLocator, Scope } from 'aurelia-binding';
import * as LogManager from 'aurelia-logging';

export interface InterpolationBindingExpression extends Expression {}

/**
 * A class to express instruction for an interpolation binding in Aurelia template
 */
export class InterpolationBindingExpression {

  /**@internal*/
  observerLocator: ObserverLocator;
  /**@internal*/
  targetProperty: string;
  /**@internal*/
  parts: Array<string | Expression>;
  /**@internal*/
  mode: bindingMode;
  /**@internal*/
  lookupFunctions: any;
  /**@internal*/
  attribute: string;
  /**@internal*/
  attrToRemove: string;
  /**@internal*/
  discrete: boolean;

  constructor(
    observerLocator: ObserverLocator,
    targetProperty: string,
    parts: Array<string | Expression>,
    mode: bindingMode,
    lookupFunctions: any,
    attribute: string
    ) {
    this.observerLocator = observerLocator;
    this.targetProperty = targetProperty;
    this.parts = parts;
    this.mode = mode;
    this.lookupFunctions = lookupFunctions;
    this.attribute = this.attrToRemove = attribute;
    this.discrete = false;
  }

  /**
   * Create a binding based on this expression instrcution and a given target
   */
  createBinding(target) {
    let observerLocator = this.observerLocator;
    let targetProperty = this.targetProperty;
    let lookupFunctions = this.lookupFunctions;
    let mode = this.mode;
    let parts = this.parts;

    if (parts.length === 3) {
      return new ChildInterpolationBinding(
        target,
        observerLocator,
        parts[1] as Expression,
        mode,
        lookupFunctions,
        targetProperty,
        parts[0] as string,
        parts[2] as string
      );
    }

    return new InterpolationBinding(
      observerLocator,
      parts,
      target,
      targetProperty,
      mode,
      lookupFunctions
      );
  }
}

function validateTarget(target: Element, propertyName: string) {
  if (propertyName === 'style') {
    LogManager.getLogger('templating-binding')
      .info('Internet Explorer does not support interpolation in "style" attributes.  Use the style attribute\'s alias, "css" instead.');
  } else if (target.parentElement && target.parentElement.nodeName === 'TEXTAREA' && propertyName === 'textContent') {
    // tslint:disable-next-line:max-line-length
    throw new Error('Interpolation binding cannot be used in the content of a textarea element.  Use <textarea value.bind="expression"></textarea> instead.');
  }
}

export class InterpolationBinding {

  /**@internal*/
  isBound: any;
  /**@internal*/
  source: any;
  /**@internal*/
  observerLocator: ObserverLocator;
  /**@internal*/
  parts: Array<string | Expression>;
  /**@internal*/
  target: Element;
  /**@internal*/
  targetProperty: string;
  /**@internal*/
  targetAccessor: any;
  /**@internal*/
  mode: bindingMode;
  /**@internal*/
  lookupFunctions: any;

  constructor(
    observerLocator: ObserverLocator,
    parts: Array<string | Expression>,
    target: Element,
    targetProperty: string,
    mode: bindingMode,
    lookupFunctions: any
  ) {
    validateTarget(target, targetProperty);
    this.observerLocator = observerLocator;
    this.parts = parts;
    this.target = target;
    this.targetProperty = targetProperty;
    this.targetAccessor = observerLocator.getAccessor(target, targetProperty);
    this.mode = mode;
    this.lookupFunctions = lookupFunctions;
  }

  interpolate() {
    if (this.isBound) {
      let value = '';
      let parts = this.parts;
      for (let i = 0, ii = parts.length; i < ii; i++) {
        value += (i % 2 === 0 ? parts[i] : this[`childBinding${i}`].value);
      }
      this.targetAccessor.setValue(value, this.target, this.targetProperty);
    }
  }

  /**
   * Semi internal method used by aurelia templating to update binding in one time fashion
   */
  updateOneTimeBindings() {
    for (let i = 1, ii = this.parts.length; i < ii; i += 2) {
      let child = this[`childBinding${i}`];
      if (child.mode === bindingMode.oneTime) {
        child.call();
      }
    }
  }

  bind(source: Scope) {
    if (this.isBound) {
      if (this.source === source) {
        return;
      }
      this.unbind();
    }
    this.source = source;

    let parts = this.parts;
    for (let i = 1, ii = parts.length; i < ii; i += 2) {
      let binding = new ChildInterpolationBinding(
        this,
        this.observerLocator,
        parts[i] as Expression,
        this.mode,
        this.lookupFunctions);

      binding.bind(source);
      this[`childBinding${i}`] = binding;
    }

    this.isBound = true;
    this.interpolate();
  }

  unbind() {
    if (!this.isBound) {
      return;
    }
    this.isBound = false;
    this.source = null;
    let parts = this.parts;
    for (let i = 1, ii = parts.length; i < ii; i += 2) {
      let name = `childBinding${i}`;
      this[name].unbind();
    }
  }
}

export class ChildInterpolationBinding {

  /**@internal*/
  parent: InterpolationBinding;
  /**@internal*/
  target: Element;
  /**@internal*/
  targetProperty: string;
  /**@internal*/
  targetAccessor: any;
  /**@internal*/
  observerLocator: ObserverLocator;
  /**@internal*/
  sourceExpression: any;
  /**@internal*/
  mode: bindingMode;
  /**@internal*/
  lookupFunctions: any;
  /**@internal*/
  left: string;
  /**@internal*/
  right: string;
  /**@internal*/
  value: any;
  /**@internal*/
  isBound: boolean;
  /**@internal*/
  rawValue: any;
  /**@internal*/
  _version: any;
  /**@internal*/
  source: Scope;

  constructor(
    target: InterpolationBinding | Element,
    observerLocator: ObserverLocator,
    sourceExpression: Expression,
    mode: bindingMode,
    lookupFunctions: any,
    targetProperty?: string,
    left?: string,
    right?: string) {

    if (target instanceof InterpolationBinding) {
      this.parent = target;
    } else {
      validateTarget(target, targetProperty);
      this.target = target;
      this.targetProperty = targetProperty;
      this.targetAccessor = observerLocator.getAccessor(target, targetProperty);
    }
    this.observerLocator = observerLocator;
    this.sourceExpression = sourceExpression;
    this.mode = mode;
    this.lookupFunctions = lookupFunctions;
    this.left = left;
    this.right = right;
  }

  updateTarget(value: any) {
    value = value === null || value === undefined ? '' : value.toString();
    if (value !== this.value) {
      this.value = value;
      if (this.parent) {
        this.parent.interpolate();
      } else {
        this.targetAccessor.setValue(this.left + value + this.right, this.target, this.targetProperty);
      }
    }
  }

  call() {
    if (!this.isBound) {
      return;
    }

    this.rawValue = this.sourceExpression.evaluate(this.source, this.lookupFunctions);
    this.updateTarget(this.rawValue);

    if (this.mode !== bindingMode.oneTime) {
      this._version++;
      this.sourceExpression.connect(this, this.source);
      if (this.rawValue instanceof Array) {
        this.observeArray(this.rawValue);
      }
      this.unobserve(false);
    }
  }

  observeArray(rawValue: any) {
    throw new Error('Method not implemented.');
  }

  unobserve(all: boolean) {
    throw new Error('Method not implemented.');
  }

  bind(source: Scope): void {
    if (this.isBound) {
      if (this.source === source) {
        return;
      }
      this.unbind();
    }
    this.isBound = true;
    this.source = source;

    let sourceExpression = this.sourceExpression;
    if (sourceExpression.bind) {
      sourceExpression.bind(this, source, this.lookupFunctions);
    }

    this.rawValue = sourceExpression.evaluate(source, this.lookupFunctions);
    this.updateTarget(this.rawValue);

    if (this.mode === bindingMode.toView) {
      enqueueBindingConnect(this as Binding);
    }
  }

  unbind() {
    if (!this.isBound) {
      return;
    }
    this.isBound = false;
    let sourceExpression = this.sourceExpression;
    if (sourceExpression.unbind) {
      sourceExpression.unbind(this, this.source);
    }
    this.source = null;
    this.value = null;
    this.rawValue = null;
    this.unobserve(true);
  }

  connect(evaluate?: boolean) {
    if (!this.isBound) {
      return;
    }
    if (evaluate) {
      this.rawValue = this.sourceExpression.evaluate(this.source, this.lookupFunctions);
      this.updateTarget(this.rawValue);
    }
    this.sourceExpression.connect(this, this.source);
    if (this.rawValue instanceof Array) {
      this.observeArray(this.rawValue);
    }
  }
}

// avoid generating excessive code
(connectable() as any)(ChildInterpolationBinding);
