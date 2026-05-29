javascript.javascriptGenerator.forBlock['wait'] = function (block) {
  var seconds = Number(block.getFieldValue('seconds'));
  var code = 'wait(' + seconds + ');\n';
  return code;
};

javascript.javascriptGenerator.forBlock['server_join'] = function (block) {
  var dropdown_room_id = block.getFieldValue('room_id');
  var text_room_token = block.getFieldValue('room_token');
  var text_name = block.getFieldValue('name');
  var statements_main_loop_content = Blockly.JavaScript.statementToCode(block, 'main_loop_content');
  // TODO: Assemble JavaScript into code variable.

  if (!text_room_token) {
    text_room_token = random_string(8);
  }
  if (!text_name) {
    text_name = "NoName"
  }

  code = 'join("' + dropdown_room_id + "?" + text_room_token + '", "' + text_name + '");\n';
  return code + statements_main_loop_content;
};

function random_string(length) {
  console.log("test randam string");
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

javascript.javascriptGenerator.forBlock['get_ready'] = function (block) {
  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info = get_ready();\n';
  return code;
};

javascript.javascriptGenerator.forBlock['direction4_value'] = function (block) {
  var dropdown_direction = block.getFieldValue('direction_value').toString();
  // TODO: Assemble JavaScript into code variable.
  code = dropdown_direction;

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['position9_value'] = function (block) {
  var dropdown_position = block.getFieldValue('position_value').toString();
  // TODO: Assemble JavaScript into code variable.
  code = dropdown_position;

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['position9_num_value'] = function (block) {
  var dropdown_position = block.getFieldValue('position_num_value').toString();
  // TODO: Assemble JavaScript into code variable.
  code = dropdown_position;

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['item4_value'] = function (block) {
  var dropdown_item = block.getFieldValue('item_value');
  // TODO: Assemble JavaScript into code variable.
  code = dropdown_item;

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['move_player'] = function (block) {
  value_move = block.getFieldValue('move');

  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info = move_player(' + value_move + ');\n';
  return code;
};



javascript.javascriptGenerator.forBlock['random_move'] = function (block) {
  // TODO: Assemble JavaScript into code variable.
  var code = '';
  code = code + '__noblock = [];\n';
  code = code + 'if (map_info[1] != 2) {\n';
  code = code + Blockly.JavaScript.INDENT + '__noblock.push("top");\n';
  code = code + '}\n';
  code = code + 'if (map_info[7] != 2) {\n';
  code = code + Blockly.JavaScript.INDENT + '__noblock.push("bottom");\n';
  code = code + '}\n';
  code = code + 'if (map_info[3] != 2) {\n';
  code = code + Blockly.JavaScript.INDENT + '__noblock.push("left");\n';
  code = code + '}\n';
  code = code + 'if (map_info[5] != 2) {\n';
  code = code + Blockly.JavaScript.INDENT + '__noblock.push("right");\n';
  code = code + '}\n';
  code = code + 'map_info = move_player(__noblock[Math.floor(Math.random() * __noblock.length)]);\n';

  return code;
};

javascript.javascriptGenerator.forBlock['put_wall'] = function (block) {
  value_put_wall = block.getFieldValue('put_wall');

  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info = put_wall(' + value_put_wall + ');\n';
  return code;
};

javascript.javascriptGenerator.forBlock['look'] = function (block) {

  value_look = block.getFieldValue('look');

  // TODO: Assemble JavaScript into code variable.
  var code = 'look_info = look(' + value_look + ');\n';
  return code;
};

javascript.javascriptGenerator.forBlock['search'] = function (block) {
  value_search = block.getFieldValue('search');

  // TODO: Assemble JavaScript into code variable.
  var code = 'search_info = search(' + value_search + ');\n';
  return code;
};

javascript.javascriptGenerator.forBlock['get_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');

  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info[' + value_map_position + ']';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['get_look_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');

  // TODO: Assemble JavaScript into code variable.
  var code = 'look_info[' + value_map_position + ']';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['get_search_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');

  // TODO: Assemble JavaScript into code variable.
  var code = 'search_info[' + value_map_position + ']';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['if_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');
  value_map_item = block.getFieldValue('map_item');

  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info[' + value_map_position + '] == ' + value_map_item + '';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_NONE];
};

javascript.javascriptGenerator.forBlock['if_look_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');
  value_map_item = block.getFieldValue('map_item').toString();

  // TODO: Assemble JavaScript into code variable.
  var code = 'look_info[' + value_map_position + '] == ' + value_map_item + '';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_NONE];
};

javascript.javascriptGenerator.forBlock['if_search_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');
  value_map_item = block.getFieldValue('map_item').toString();

  // TODO: Assemble JavaScript into code variable.
  var code = 'search_info[' + value_map_position + '] == ' + value_map_item + '';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_NONE];
};


// exprty mode
javascript.javascriptGenerator.forBlock['move_player_exp'] = function (block) {
  var value_move = javascript.javascriptGenerator.valueToCode(block, 'move', Blockly.JavaScript.ORDER_ATOMIC);

  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info = move_player(' + value_move + ');\n';
  return code;
};

javascript.javascriptGenerator.forBlock['put_wall_exp'] = function (block) {
  var value_put_wall = javascript.javascriptGenerator.valueToCode(block, 'put_wall', Blockly.JavaScript.ORDER_ATOMIC);

  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info = put_wall(' + value_put_wall + ');\n';
  return code;
};

javascript.javascriptGenerator.forBlock['look_exp'] = function (block) {
  var value_look = javascript.javascriptGenerator.valueToCode(block, 'look', Blockly.JavaScript.ORDER_ATOMIC);

  // TODO: Assemble JavaScript into code variable.
  var code = 'look_info = look(' + value_look + ');\n';
  return code;
};

javascript.javascriptGenerator.forBlock['search_exp'] = function (block) {
  var value_search = javascript.javascriptGenerator.valueToCode(block, 'search', Blockly.JavaScript.ORDER_ATOMIC);

  // TODO: Assemble JavaScript into code variable.
  var code = 'search_info = search(' + value_search + ');\n';
  return code;
};

javascript.javascriptGenerator.forBlock['get_ready_list'] = function (block) {
  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['look_list'] = function (block) {
  // TODO: Assemble JavaScript into code variable.
  var code = 'look_info';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['search_list'] = function (block) {
  // TODO: Assemble JavaScript into code variable.
  var code = 'search_info';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['get_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');

  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info[' + value_map_position + ']';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['get_value_exp'] = function (block) {
  var value_map_position = javascript.javascriptGenerator.valueToCode(block, 'map_position', Blockly.JavaScript.ORDER_ATOMIC);

  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info[' + value_map_position + ']';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['get_look_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');

  // TODO: Assemble JavaScript into code variable.
  var code = 'look_info[' + value_map_position + ']';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['get_look_value_exp'] = function (block) {
  var value_map_position = javascript.javascriptGenerator.valueToCode(block, 'map_position', Blockly.JavaScript.ORDER_ATOMIC);

  // TODO: Assemble JavaScript into code variable.
  var code = 'look_info[' + value_map_position + ']';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['get_search_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');

  // TODO: Assemble JavaScript into code variable.
  var code = 'search_info[' + value_map_position + ']';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['get_search_value_exp'] = function (block) {
  var value_map_position = javascript.javascriptGenerator.valueToCode(block, 'map_position', Blockly.JavaScript.ORDER_ATOMIC);

  // TODO: Assemble JavaScript into code variable.
  var code = 'search_info[' + value_map_position + ']';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['if_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');
  value_map_item = block.getFieldValue('map_item');

  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info[' + value_map_position + '] == ' + value_map_item + '';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_NONE];
};

javascript.javascriptGenerator.forBlock['if_value_exp'] = function (block) {
  var value_map_position = javascript.javascriptGenerator.valueToCode(block, 'map_position', Blockly.JavaScript.ORDER_ATOMIC);
  var value_map_item = javascript.javascriptGenerator.valueToCode(block, 'map_item', Blockly.JavaScript.ORDER_ATOMIC);

  // TODO: Assemble JavaScript into code variable.
  var code = 'map_info[' + value_map_position + '] == ' + value_map_item + '';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_NONE];
};

javascript.javascriptGenerator.forBlock['if_look_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');
  value_map_item = block.getFieldValue('map_item').toString();

  // TODO: Assemble JavaScript into code variable.
  var code = 'look_info[' + value_map_position + '] == ' + value_map_item + '';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_NONE];
};

javascript.javascriptGenerator.forBlock['if_look_value_exp'] = function (block) {
  var value_map_position = javascript.javascriptGenerator.valueToCode(block, 'map_position', Blockly.JavaScript.ORDER_ATOMIC);
  var value_map_item = javascript.javascriptGenerator.valueToCode(block, 'map_item', Blockly.JavaScript.ORDER_ATOMIC);

  // TODO: Assemble JavaScript into code variable.
  var code = 'look_info[' + value_map_position + '] == ' + value_map_item + '';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_NONE];
};

javascript.javascriptGenerator.forBlock['if_search_value'] = function (block) {
  value_map_position = block.getFieldValue('map_position');
  value_map_item = block.getFieldValue('map_item').toString();

  // TODO: Assemble JavaScript into code variable.
  var code = 'search_info[' + value_map_position + '] == ' + value_map_item + '';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_NONE];
};

javascript.javascriptGenerator.forBlock['if_search_value_exp'] = function (block) {
  var value_map_position = javascript.javascriptGenerator.valueToCode(block, 'map_position', Blockly.JavaScript.ORDER_ATOMIC);
  var value_map_item = javascript.javascriptGenerator.valueToCode(block, 'map_item', Blockly.JavaScript.ORDER_ATOMIC);

  // TODO: Assemble JavaScript into code variable.
  var code = 'search_info[' + value_map_position + '] == ' + value_map_item + '';

  // TODO: Change ORDER_NONE to the correct strength.
  return [code, Blockly.JavaScript.ORDER_NONE];
};


javascript.javascriptGenerator.forBlock['infinite_loop'] = function (block) {
  var statements_infinite_loop_content = Blockly.JavaScript.statementToCode(block, 'infinite_loop_content');
  // TODO: Assemble JavaScript into code variable.
  statements_infinite_loop_content = Blockly.JavaScript.addLoopTrap(statements_infinite_loop_content, block);
  var code = 'while (!false) {\n' + statements_infinite_loop_content + '}\n';
  return code;
};

javascript.javascriptGenerator.forBlock['math_number_dropdown'] = function(block) {
  const value = block.getFieldValue('NUM');
  return [value, Blockly.JavaScript.ORDER_ATOMIC];
};

javascript.javascriptGenerator.forBlock['comment_block'] = function(block) {
  const comment = block.getFieldValue('COMMENT');
  const code = `// ${comment}\n`;
  return code;
};
