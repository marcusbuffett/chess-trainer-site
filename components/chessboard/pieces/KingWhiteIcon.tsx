import * as React from "react";
import Svg, { Path, Rect } from "react-native-svg";

function SvgComponent(props) {
  return (
    <Svg
      width="100%"
      height="100%"
      clipRule="evenodd"
      fillRule="evenodd"
      imageRendering="optimizeQuality"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      viewBox="0 0 50 50"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Path
        d="M27.67 15.225v-3.544h4.44V7.252h-4.935V3.36H22.81v3.893h-4.934v4.43h4.44v3.543"
        fill="#f0f0f0"
        strokeLinecap="round"
        strokeWidth={1.2}
        stroke="#3c3c3c"
      />
      <Rect
        x={20.299}
        y={14.215}
        width={9.398}
        height={2.787}
        ry={1.394}
        fill="#f0f0f0"
        strokeLinejoin="round"
        strokeWidth={1.2}
        stroke="#3c3c3c"
      />
      <Path
        d="M26.416 14.215c.725 0 1.308.621 1.308 1.393 0 .773-.583 1.394-1.308 1.394h1.974c.724 0 1.308-.621 1.308-1.393 0-.773-.584-1.394-1.308-1.394z"
        opacity={0.15}
      />
      <Path
        d="M21.631 14.842c-.402 0-.725.345-.725.773 0 .427.323.772.725.772h.874c-.402 0-.725-.345-.725-.772 0-.428.323-.773.725-.773z"
        fill="#fff"
      />
      <Path
        d="M33.635 36.986s7.776-13.318 6.613-15.916c-1.164-2.596-8.48-4.497-15.248-4.497-6.768 0-14.084 1.9-15.248 4.497-1.164 2.597 6.612 15.916 6.612 15.916z"
        fill="#f0f0f0"
        strokeLinecap="round"
        strokeWidth={1.2}
        stroke="#3c3c3c"
      />
      <Path
        d="M24.996 16.576c15.938 2.622 12.573 9.354 6.64 22.543l2.028-1.729s7.747-13.723 6.584-16.32c-1.545-2.833-7.503-4.159-15.252-4.494z"
        opacity={0.15}
      />
      <Path
        d="M23.765 17.295c-3.904-.184-14.621 1.801-13.503 5.017.817 3.727 2.754 7.244 4.508 10.504-5.687-10.335-5.942-13.774 8.995-15.521zM23.391 3.997l-.016 3.312h.546l.016-3.312zm-4.931 3.87l-.008 3.208h.774l.007-3.208zm4.413 3.213l.025 2.486h.52l-.025-2.486z"
        fill="#fff"
      />
      <Path
        d="M26.189 3.358v3.894h.987V3.358zm4.441 3.894v4.945h1.48V7.252zm-4.44 4.429v2.492h1.48v-2.492z"
        opacity={0.15}
      />
      <Path
        d="M25 36.457s-9.13.048-11.691 1.62c-1.727 1.06-2.135 3.65-1.9 6.323h27.182c.235-2.672-.172-5.264-1.9-6.324-2.56-1.57-11.69-1.619-11.69-1.619z"
        fill="#f0f0f0"
        strokeLinejoin="round"
        strokeWidth={1.2}
        stroke="#3c3c3c"
      />
      <Path
        d="M25 37.147s-8.712-.137-11.624 1.666c-.37.229-.7.84-.954 1.39.261-.331.503-.613.887-.849C15.869 37.783 25 37.734 25 37.734s9.132.049 11.692 1.62c.391.24.592.532.856.87.025-.076-.409-1.158-1.144-1.596C33.648 37.136 25 37.148 25 37.148z"
        fill="#fff"
      />
    </Svg>
  );
}

export default SvgComponent;

