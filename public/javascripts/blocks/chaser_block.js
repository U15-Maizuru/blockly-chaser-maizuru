Blockly.Blocks['wait'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(new Blockly.FieldNumber(0, 0, 60, 0.1), "seconds")
      .appendField("秒　待つ");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(195);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

window.addEventListener('load', function () {
  getServerList();
})

function getServerList() {
  var url = './../api/join';
  fetch(url)
    .then(function (data) {
      return data.json();
    })
    .then(function (json) {
      Blockly.Blocks['server_join'] = {
        init: function () {
          this.appendDummyInput()
            .appendField("合言葉")
            .appendField(new Blockly.FieldTextInput('', function(newValue) {
              return /^[\x00-\x7F]*$/.test(newValue) ? newValue : '';
            }), "room_token")
            .appendField("で")
            .appendField(new Blockly.FieldDropdown(json), "room_id")
            .appendField(Blockly.Msg["SERVER_JOIN_BEFORE"])
            .appendField(new Blockly.FieldTextInput(""), "name")
            .appendField(Blockly.Msg["SERVER_JOIN_AFTER"]);
          this.appendStatementInput("main_loop_content")
            .setCheck(null);
          this.setInputsInline(true);
          this.setColour(195);
          this.setTooltip("");
          this.setHelpUrl("");
        },
        getDeveloperVariables: function () {
          return ['player'];
        }
      };
      initDataLoad();
    });
}


Blockly.Blocks['get_ready'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["WAIT_MY_TURN"]);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(195);
    this.setTooltip("");
    this.setHelpUrl("");
  },
  getDeveloperVariables: function () {
    return ['map_info'];
  }
};

// basic mode

Blockly.Blocks['move_player'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([[Blockly.Msg["DIRECTION_COMMAND_TOP"], '"top"'], [Blockly.Msg["DIRECTION_COMMAND_BOTTOM"], '"bottom"'],
      [Blockly.Msg["DIRECTION_COMMAND_LEFT"], '"left"'], [Blockly.Msg["DIRECTION_COMMAND_RIGHT"], '"right"']]),
        "move")
      .appendField("方向" + Blockly.Msg["MOVE_MSG"]);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(90);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['random_move'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("ランダムに移動する");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(90);
    this.setTooltip("ブロックを避けてランダムに移動する");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['put_wall'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([[Blockly.Msg["DIRECTION_COMMAND_TOP"], '"top"'], [Blockly.Msg["DIRECTION_COMMAND_BOTTOM"], '"bottom"'],
      [Blockly.Msg["DIRECTION_COMMAND_LEFT"], '"left"'], [Blockly.Msg["DIRECTION_COMMAND_RIGHT"], '"right"']]),
        "put_wall")
      .appendField("方向" + Blockly.Msg["PUT_MSG"]);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(90);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['look'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([[Blockly.Msg["DIRECTION_COMMAND_TOP"], '"top"'], [Blockly.Msg["DIRECTION_COMMAND_BOTTOM"], '"bottom"'],
      [Blockly.Msg["DIRECTION_COMMAND_LEFT"], '"left"'], [Blockly.Msg["DIRECTION_COMMAND_RIGHT"], '"right"']]),

        "look")
      .appendField("方向" + Blockly.Msg["LOOK_MSG"]);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(90);
    this.setTooltip("");
    this.setHelpUrl("");
  },
  getDeveloperVariables: function () {
    return ['look_info'];
  }
};

Blockly.Blocks['search'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([[Blockly.Msg["DIRECTION_COMMAND_TOP"], '"top"'], [Blockly.Msg["DIRECTION_COMMAND_BOTTOM"], '"bottom"'],
      [Blockly.Msg["DIRECTION_COMMAND_LEFT"], '"left"'], [Blockly.Msg["DIRECTION_COMMAND_RIGHT"], '"right"']]),

        "search")
      .appendField("方向" + Blockly.Msg["SEARCH_MSG"]);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(90);
    this.setTooltip("");
    this.setHelpUrl("");
  },
  getDeveloperVariables: function () {
    return ['search_info'];
  }
};

Blockly.Blocks['get_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["MYSELF"])
      .appendField(new Blockly.FieldDropdown([[Blockly.Msg["POSISION_COMMAND_TOP"], "1"], [Blockly.Msg["POSISION_COMMAND_BOTTOM"], "7"],
      [Blockly.Msg["POSISION_COMMAND_LEFT"], "3"], [Blockly.Msg["POSISION_COMMAND_RIGHT"], "5"],
      [Blockly.Msg["POSISION_COMMAND_TOPLEFT"], "0"], [Blockly.Msg["POSISION_COMMAND_TOPRIGHT"], "2"],
      [Blockly.Msg["POSISION_COMMAND_BOTTOMLEFT"], "6"], [Blockly.Msg["POSISION_COMMAND_BOTTOMRIGHT"], "8"],
      [Blockly.Msg["POSISION_COMMAND_CENTER"], "4"]]),
        "map_position")
      .appendField("の" + Blockly.Msg["MAP_VALUE_INFO"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setColour(260);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['get_look_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["LOOK_VAL"])
      .appendField(new Blockly.FieldDropdown([[Blockly.Msg["POSISION_COMMAND_TOP"], "1"], [Blockly.Msg["POSISION_COMMAND_BOTTOM"], "7"],
      [Blockly.Msg["POSISION_COMMAND_LEFT"], "3"], [Blockly.Msg["POSISION_COMMAND_RIGHT"], "5"],
      [Blockly.Msg["POSISION_COMMAND_TOPLEFT"], "0"], [Blockly.Msg["POSISION_COMMAND_TOPRIGHT"], "2"],
      [Blockly.Msg["POSISION_COMMAND_BOTTOMLEFT"], "6"], [Blockly.Msg["POSISION_COMMAND_BOTTOMRIGHT"], "8"],
      [Blockly.Msg["POSISION_COMMAND_CENTER"], "4"]]),
        "map_position")
      .appendField("の" + Blockly.Msg["MAP_VALUE_INFO"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setColour(260);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['get_search_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["SEARCH_VAL"])
      .appendField(new Blockly.FieldDropdown([["1", "0"], ["2", "1"], ["3", "2"], ["4", "3"], ["5", "4"], ["6", "5"], ["7", "6"], ["8", "7"], ["9", "8"]]), "map_position")
      .appendField("番目の" + Blockly.Msg["MAP_VALUE_INFO"]);
    this.setInputsInline(true);
    this.setOutput(true, "Number");
    this.setColour(260);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['if_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["MYSELF"])
      .appendField(new Blockly.FieldDropdown([[Blockly.Msg["POSISION_COMMAND_TOP"], "1"], [Blockly.Msg["POSISION_COMMAND_BOTTOM"], "7"],
      [Blockly.Msg["POSISION_COMMAND_LEFT"], "3"], [Blockly.Msg["POSISION_COMMAND_RIGHT"], "5"],
      [Blockly.Msg["POSISION_COMMAND_TOPLEFT"], "0"], [Blockly.Msg["POSISION_COMMAND_TOPRIGHT"], "2"],
      [Blockly.Msg["POSISION_COMMAND_BOTTOMLEFT"], "6"], [Blockly.Msg["POSISION_COMMAND_BOTTOMRIGHT"], "8"],
      [Blockly.Msg["POSISION_COMMAND_CENTER"], "4"]]),
        "map_position")
      .appendField("の" + Blockly.Msg["MAP_VALUE_INFO"] + "が")
      .appendField(new Blockly.FieldDropdown([["アイテム", "3"], ["ブロック", "2"], ["プレイヤー", "1"], ["なにもない", "0"]]), "map_item")
      .appendField("なら");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setColour(225);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['if_look_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["LOOK_VAL"])
      .appendField(new Blockly.FieldDropdown([[Blockly.Msg["POSISION_COMMAND_TOP"], "1"], [Blockly.Msg["POSISION_COMMAND_BOTTOM"], "7"],
      [Blockly.Msg["POSISION_COMMAND_LEFT"], "3"], [Blockly.Msg["POSISION_COMMAND_RIGHT"], "5"],
      [Blockly.Msg["POSISION_COMMAND_TOPLEFT"], "0"], [Blockly.Msg["POSISION_COMMAND_TOPRIGHT"], "2"],
      [Blockly.Msg["POSISION_COMMAND_BOTTOMLEFT"], "6"], [Blockly.Msg["POSISION_COMMAND_BOTTOMRIGHT"], "8"],
      [Blockly.Msg["POSISION_COMMAND_CENTER"], "4"]]),
        "map_position")
      .appendField("の" + Blockly.Msg["MAP_VALUE_INFO"] + "が")
      .appendField(new Blockly.FieldDropdown([["アイテム", "3"], ["ブロック", "2"], ["プレイヤー", "1"], ["なにもない", "0"]]), "map_item")
      .appendField("なら");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setColour(225);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['if_search_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["SEARCH_VAL"])
      .appendField(new Blockly.FieldDropdown([["1", "0"], ["2", "1"], ["3", "2"], ["4", "3"], ["5", "4"], ["6", "5"], ["7", "6"], ["8", "7"], ["9", "8"]]), "map_position")
      .appendField("番目の" + Blockly.Msg["MAP_VALUE_INFO"] + "が")
      .appendField(new Blockly.FieldDropdown([["アイテム", "3"], ["ブロック", "2"], ["プレイヤー", "1"], ["なにもない", "0"]]), "map_item")
      .appendField("なら");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setColour(225);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['infinite_loop'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["INFINITE_LOOP"]);
    this.appendStatementInput("infinite_loop_content")
      .setCheck(null);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(120);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['math_number_dropdown'] = {
  init: function() {
    // デフォルト値
    const min = this.min ?? 0;
    const max = this.max ?? 10;
    const step = this.step ?? 1;

    const options = [];
    for (let i = min; i <= max; i += step) {
      options.push([String(i), String(i)]);
    }

    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown(options), "NUM");
    this.setOutput(true, "Number");
    this.setColour(230);
  }
};


// expert mode

Blockly.Blocks['direction4_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([[Blockly.Msg["DIRECTION_COMMAND_TOP"], '"top"'], [Blockly.Msg["DIRECTION_COMMAND_BOTTOM"], '"bottom"'],
      [Blockly.Msg["DIRECTION_COMMAND_LEFT"], '"left"'], [Blockly.Msg["DIRECTION_COMMAND_RIGHT"], '"right"']]),
        "direction_value")
      .appendField("方向");
    this.setInputsInline(true);
    this.setOutput(true, "Direction4");
    this.setColour(90);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['position9_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([[Blockly.Msg["POSISION_COMMAND_TOP"], "1"], [Blockly.Msg["POSISION_COMMAND_BOTTOM"], "7"],
      [Blockly.Msg["POSISION_COMMAND_LEFT"], "3"], [Blockly.Msg["POSISION_COMMAND_RIGHT"], "5"],
      [Blockly.Msg["POSISION_COMMAND_TOPLEFT"], "0"], [Blockly.Msg["POSISION_COMMAND_TOPRIGHT"], "2"],
      [Blockly.Msg["POSISION_COMMAND_BOTTOMLEFT"], "6"], [Blockly.Msg["POSISION_COMMAND_BOTTOMRIGHT"], "8"],
      [Blockly.Msg["POSISION_COMMAND_CENTER"], "4"]]),
        "position_value")
      .appendField("の");
    this.setInputsInline(true);
    this.setOutput(true, "Position9");
    this.setColour(150);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['position9_num_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([["1", "0"], ["2", "1"], ["3", "2"], ["4", "3"],
      ["5", "4"], ["6", "5"], ["7", "6"], ["8", "7"], ["9", "8"]]),
        "position_num_value")
      .appendField("番目の");
    this.setInputsInline(true);
    this.setOutput(true, "Position9_num");
    this.setColour(150);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['item4_value'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(new Blockly.FieldDropdown([["アイテム", "3"], ["ブロック", "2"], ["プレイヤー", "1"], ["なにもない", "0"]]),
        "item_value")
    this.setInputsInline(true);
    this.setOutput(true, "Item4");
    this.setColour(225);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['move_player_exp'] = {
  init: function () {
    this.appendValueInput("move")
      .setCheck("Direction4");
    this.appendDummyInput()
      .appendField(Blockly.Msg["MOVE_MSG"]);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(90);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['put_wall_exp'] = {
  init: function () {
    this.appendValueInput("put_wall")
      .setCheck("Direction4");
    this.appendDummyInput()
      .appendField(Blockly.Msg["PUT_MSG"]);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(90);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['look_exp'] = {
  init: function () {
    this.appendValueInput("look")
      .setCheck("Direction4");
    this.appendDummyInput()
      .appendField(Blockly.Msg["LOOK_MSG"]);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(90);
    this.setTooltip("");
    this.setHelpUrl("");
  },
  getDeveloperVariables: function () {
    return ['look_info'];
  }
};


Blockly.Blocks['search_exp'] = {
  init: function () {
    this.appendValueInput("search")
      .setCheck("Direction4");
    this.appendDummyInput()
      .appendField(Blockly.Msg["SEARCH_MSG"]);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(90);
    this.setTooltip("");
    this.setHelpUrl("");
  },
  getDeveloperVariables: function () {
    return ['search_info'];
  }
};

Blockly.Blocks['get_ready_list'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("周辺情報リスト");
    this.setInputsInline(true);
    this.setOutput(true, "Array");
    this.setColour(290);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};


Blockly.Blocks['look_list'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("近隣情報リスト");
    this.setInputsInline(true);
    this.setOutput(true, "Array");
    this.setColour(290);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['search_list'] = {
  init: function () {
    this.appendDummyInput()
      .appendField("遠方情報リスト");
    this.setInputsInline(true);
    this.setOutput(true, "Array");
    this.setColour(290);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['get_value_exp'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["MYSELF"]);
    this.appendValueInput("map_position")
      .setCheck("Position9");
    this.appendDummyInput()
      .appendField(Blockly.Msg["MAP_VALUE_INFO"]);
    this.appendDummyInput();
    this.setInputsInline(true);
    this.setOutput(true, "Item4");
    this.setColour(260);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['get_look_value_exp'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["LOOK_VAL"]);
    this.appendValueInput("map_position")
      .setCheck("Position9");
    this.appendDummyInput()
      .appendField(Blockly.Msg["MAP_VALUE_INFO"]);
    this.appendDummyInput();
    this.setInputsInline(true);
    this.setOutput(true, "Item4");
    this.setColour(260);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['get_search_value_exp'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["SEARCH_VAL"])
    this.appendValueInput("map_position")
      .setCheck("Position9_num");
    this.appendDummyInput()
      .appendField(Blockly.Msg["MAP_VALUE_INFO"]);
    this.setInputsInline(true);
    this.setOutput(true, "Item4");
    this.setColour(260);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['if_value_exp'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["MYSELF"]);
    this.appendValueInput("map_position")
      .setCheck("Position9");
    this.appendDummyInput()
      .appendField(Blockly.Msg["MAP_VALUE_INFO"] + "が");
    this.appendValueInput("map_item")
      .setCheck("Item4");
    this.appendDummyInput()
      .appendField("なら");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setColour(225);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['if_look_value_exp'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["LOOK_VAL"])
    this.appendValueInput("map_position")
      .setCheck("Position9");
    this.appendDummyInput()
      .appendField(Blockly.Msg["MAP_VALUE_INFO"] + "が")
    this.appendValueInput("map_item")
      .setCheck("Item4");
    this.appendDummyInput()
      .appendField("なら");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setColour(225);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.Blocks['if_search_value_exp'] = {
  init: function () {
    this.appendDummyInput()
      .appendField(Blockly.Msg["SEARCH_VAL"])
    this.appendValueInput("map_position")
      .setCheck("Position9_num");
    this.appendDummyInput()
      .appendField(Blockly.Msg["MAP_VALUE_INFO"] + "が")
    this.appendValueInput("map_item")
      .setCheck("Item4");
    this.appendDummyInput()
      .appendField("なら");
    this.setInputsInline(true);
    this.setOutput(true, "Boolean");
    this.setColour(225);
    this.setTooltip("");
    this.setHelpUrl("");
  }
};

Blockly.libraryBlocks.loops.loopTypes.add('infinite_loop');

Blockly.Blocks['comment_block'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput("コメント"), "COMMENT");
    this.setColour('#FFF9C4');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setTooltip("コードには影響しないコメントブロック");
    this.setHelpUrl("");
  }
};