
import React, { useEffect, useRef } from 'react';
import abcjs from 'abcjs';

interface Props {
  abc: string;
}

export const StandardNotation: React.FC<Props> = ({ abc }) => {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (divRef.current && abc.trim() !== '') {
      abcjs.renderAbc(divRef.current, abc, {
        responsive: 'resize',
        add_classes: true,
        staffwidth: 720,
        paddingtop: 0,
        paddingbottom: 0,
        paddingleft: 0,
        paddingright: 0,
        format: {
          gchordfont: 'Georgia, serif',
          vocalfont: 'Georgia, serif',
          wordsfont: 'Georgia, serif',
        }
      });
    } else if (divRef.current) {
      divRef.current.innerHTML = '';
    }
  }, [abc]);

  return <div ref={divRef} className="w-full abcjs-container avoid-break"></div>;
};
