import {toWidget} from "@ckeditor/ckeditor5-widget/src/utils";
import ButtonView from "@ckeditor/ckeditor5-ui/src/button/buttonview";

import BaseLayout from "../base-layout";
import {createLayoutEditable} from "../editable";
import Layout2ColIcon from "./2col.svg";
import Layout3ColIcon from "./3col.svg";
import Layout from "../layout";
import LayoutColumnCommand from "./layoutcolumncommand";

import "./styles.css";

const CMD_LAYOUT_COLUMN = 'layout-column';
const LAYOUT_COLUMN_2 = 'layout-column-2';
const LAYOUT_COLUMN_3 = 'layout-column-3';
const LAYOUT_COLUMN_4 = 'layout-column-4';
const LAYOUT_COLUMN_3_7 = 'layout-column-3/7';

export default class ColumnLayout extends BaseLayout
{
  _schemaName()
  {
    return 'layout-column';
  }

  _schemaDefinition()
  {
    let def = super._schemaDefinition();
    def['allowAttributes'] = ['columns'];
    return def;
  }

  init()
  {
    super.init();

    const editor = this.editor;
    const t = editor.t;

    const cmd = new LayoutColumnCommand(editor);
    editor.commands.add(CMD_LAYOUT_COLUMN, cmd);

    // column ui
    editor.ui.componentFactory.add(
      LAYOUT_COLUMN_2, locale =>
      {
        const btn = new ButtonView(locale);

        btn.set(
          {
            label: t('Two Column'),
            icon: Layout2ColIcon,
            tooltip: true
          }
        );

        // Execute command.
        this.listenTo(btn, 'execute', () => cmd.execute(2));

        return btn;
      }
    );
    editor.ui.componentFactory.add(
      LAYOUT_COLUMN_3, locale =>
      {
        const btn = new ButtonView(locale);

        btn.set(
          {
            label: t('Three Column'),
            icon: Layout3ColIcon,
            tooltip: true
          }
        );

        // Execute command.
        this.listenTo(btn, 'execute', () => cmd.execute(3));

        return btn;
      }
    );

    editor.plugins.get(Layout).registeredCommands.push(cmd);
    editor.plugins.get(Layout).registeredLayouts.push(
      editor.ui.componentFactory.create(LAYOUT_COLUMN_2),
      editor.ui.componentFactory.create(LAYOUT_COLUMN_3)
    );

    const conversion = editor.conversion;

    conversion.for('upcast').add(viewLayoutToModel());

    conversion.for('dataDowncast').elementToElement(
      {
        model: this._schemaName(),
        view: (modelItem, viewWriter) => viewWriter.createContainerElement(
          'div', {
            class: 'ck-layout-columns',
            columns: modelItem.getAttribute('columns')
          }
        )
      }
    );

    conversion.for('editingDowncast').elementToElement(
      {
        model: this._schemaName(),
        view: (modelItem, viewWriter) =>
        {
          const widgetElement = viewWriter.createContainerElement(
            'div',
            {
              class: 'ck-layout-columns',
              columns: modelItem.getAttribute('columns')
            }
          );
          // Enable widget handling on placeholder element inside editing view.
          return toWidget(widgetElement, viewWriter);
        }
      }
    );

    let _schemaName = this._schemaName();

    function viewLayoutToModel()
    {
      return dispatcher =>
      {
        dispatcher.on('element:div', converter);
      };

      function converter(evt, data, conversionApi)
      {
        const viewLayout = data.viewItem;

        // Do not convert if this is not a "column layout".
        if(!conversionApi.consumable.test(
          viewLayout,
          {name: true, attributes: 'columns', classes: 'ck-layout-columns'}
        ))
        {
          return;
        }

        const colCount = viewLayout.getAttribute('columns');

        const layout = conversionApi.writer.createElement(_schemaName, {columns: colCount});

        // Insert element on allowed position.
        const splitResult = conversionApi.splitToAllowedParent(layout, data.modelCursor);

        // When there is no split result it means that we can't insert element to model tree, so let's skip it.
        if(!splitResult)
        {
          return;
        }

        conversionApi.writer.insert(layout, splitResult.position);
        conversionApi.consumable.consume(viewLayout, {name: true});

        // process existing divs
        let doneCols = 0;
        Array.from(data.viewItem.getChildren()).forEach(
          viewEditable =>
          {
            conversionApi.consumable.consume(viewEditable, {name: true}); // IMPORTANT: CONSUME KILLS IT
            if(viewEditable.is('div'))
            {
              if(doneCols < colCount)
              {
                // create editable
                let editable = conversionApi.writer.createElement('layout-editable');
                conversionApi.convertChildren(viewEditable, conversionApi.writer.createPositionAt(editable, 'end'));
                conversionApi.writer.insert(editable, conversionApi.writer.createPositionAt(layout, 'end'));
                doneCols++;
              }
            }
          }
        );

        while(doneCols < colCount)
        {
          // create new ones
          createLayoutEditable(conversionApi.writer, layout);
          doneCols++;
        }

        // Set conversion result range.
        data.modelRange = conversionApi.writer.createRange(
          // Range should start before inserted element
          conversionApi.writer.createPositionBefore(layout),
          // Should end after but we need to take into consideration that children could split our
          // element, so we need to move range after parent of the last converted child.
          // before: <allowed>[]</allowed>
          // after: <allowed>[<converted><child></child></converted><child></child><converted>]</converted></allowed>
          conversionApi.writer.createPositionAfter(layout)
        );

        // Now we need to check where the modelCursor should be.
        // If we had to split parent to insert our element then we want to continue conversion inside split parent.
        //
        // before: <allowed><notAllowed>[]</notAllowed></allowed>
        // after:  <allowed><notAllowed></notAllowed><converted></converted><notAllowed>[]</notAllowed></allowed>
        if(splitResult.cursorParent)
        {
          data.modelCursor = conversionApi.writer.createPositionAt(splitResult.cursorParent, 0);

          // Otherwise just continue after inserted element.
        }
        else
        {
          data.modelCursor = data.modelRange.end;
        }
      }
    }
  }
}

export function createColumnLayout(writer, insertPosition, columnCount)
{
  let layout = writer.createElement('layout-column', {columns: columnCount});
  for(let i = 0; i < columnCount; i++)
  {
    createLayoutEditable(writer, layout);
  }

  writer.model.insertContent(layout, insertPosition);
  writer.setSelection(writer.createPositionAt(layout, 0));
}