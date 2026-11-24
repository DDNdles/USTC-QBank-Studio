/**
 * Exact millimeter-coordinate SVG recreation of dsh-study's TikZ \DrawUstcBindingLine
 * (src/templates/pdf/ustc-exam/template.tex lines 70-92).
 * viewBox="0 0 28 297" maps 1 unit = 1mm on an A4 page (210mm x 297mm).
 */
export function UstcBindingLine({
  className = '',
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  if (compact) {
    // Cropped top portion for the homepage specimen card
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 28 165"
        preserveAspectRatio="xMinYMid slice"
        aria-hidden="true"
        className={className}
      >
        <line
          x1="19"
          y1="8"
          x2="19"
          y2="157"
          stroke="#111111"
          strokeWidth="0.22"
          strokeDasharray="1.45 1.45"
        />
        {[28, 86, 144].map(cy => (
          <circle
            key={cy}
            cx="19"
            cy={cy}
            r="2.8"
            fill="#FFFFFF"
            stroke="#404040"
            strokeWidth="0.18"
          />
        ))}
        <g
          transform="translate(11.5, 86) rotate(-90)"
          fill="#111111"
          fontSize="3.3"
          fontFamily='"SimSun","Songti SC","Noto Serif CJK SC","STSong",serif'
        >
          <text x="-58" y="0.9">学生所在院系：</text>
          <line x1="-34.5" y1="1.6" x2="-13" y2="1.6" stroke="#111111" strokeWidth="0.18" />
          <text x="-4" y="0.9">姓名：</text>
          <line x1="6" y1="1.6" x2="22" y2="1.6" stroke="#111111" strokeWidth="0.18" />
          <text x="31" y="0.9">学号：</text>
          <line x1="41" y1="1.6" x2="58" y2="1.6" stroke="#111111" strokeWidth="0.18" />
        </g>
        <text
          transform="translate(23.2, 86) rotate(-90)"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#111111"
          fontSize="3.2"
          fontFamily='"SimSun","Songti SC","Noto Serif CJK SC","STSong",serif'
        >
          装订线　　答题时不要超过此线
        </text>
      </svg>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 297"
      preserveAspectRatio="xMinYMid meet"
      aria-hidden="true"
      className={className}
    >
      {/* Dashed vertical line at x=19mm, from y=14mm to y=283mm */}
      <line
        x1="19"
        y1="14"
        x2="19"
        y2="283"
        stroke="#111111"
        strokeWidth="0.22"
        strokeDasharray="1.45 1.45"
      />
      {/* 4 hollow binding holes at y=46, 118, 186, 254mm, r=2.8mm */}
      {[46, 118, 186, 254].map(cy => (
        <circle
          key={cy}
          cx="19"
          cy={cy}
          r="2.8"
          fill="#FFFFFF"
          stroke="#404040"
          strokeWidth="0.18"
        />
      ))}
      {/* Left student info at x=11.5mm, y=152mm, rotated 90deg CCW */}
      <g
        transform="translate(11.5, 152) rotate(-90)"
        fill="#111111"
        fontSize="3.35"
        fontFamily='"SimSun","Songti SC","Noto Serif CJK SC","STSong",serif'
      >
        <text x="-63" y="0.9">学生所在院系：</text>
        <line x1="-39.5" y1="1.6" x2="-15.5" y2="1.6" stroke="#111111" strokeWidth="0.18" />
        <text x="-5.5" y="0.9">姓名：</text>
        <line x1="4.5" y1="1.6" x2="22.5" y2="1.6" stroke="#111111" strokeWidth="0.18" />
        <text x="32.5" y="0.9">学号：</text>
        <line x1="42.5" y1="1.6" x2="62.5" y2="1.6" stroke="#111111" strokeWidth="0.18" />
      </g>
      {/* Right notice at x=22.8mm, y=150mm, rotated 90deg CCW */}
      <text
        transform="translate(23.1, 150) rotate(-90)"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#111111"
        fontSize="3.2"
        fontFamily='"SimSun","Songti SC","Noto Serif CJK SC","STSong",serif'
      >
        装订线　　　答题时不要超过此线
      </text>
    </svg>
  )
}
