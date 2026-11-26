import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Browser, Calendar, Character, Clock, ConsoleCard, Each, EmailView, InboxList, Laptop, Letter, LogTable, Panel, Phone, Router, Scene, SpeechBubble, StatTile, StickyNote, Thoughts, thoughtWords, Toast, Tray } from './kit'
import { sampleEmailFrame } from './settingEmail'

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>)

describe('frame kit', () => {
  it('draws every piece with its words as text', () => {
    const out = html(
      <Panel caption="Caption words">
        <Browser url="https://example.test/page" title="Tab words" secure>
          Page words
        </Browser>
        <Laptop>
          <Tray items={[{ label: 'Wi-Fi', detail: 'off' }]} time="10:58 PM" />
        </Laptop>
        <Toast app="App" title="Toast title" body="Toast body" />
        <Phone time="10:58" battery="21%" notices={[{ app: 'Chat', text: 'Phone words', time: 'now' }]} />
        <EmailView fromName="Sender" fromAddress="a@b.test" to="c@d.test" subject="Subject words" date="Tue" link={{ label: 'Go', url: 'https://link.test' }} attachments={['file.pdf']}>
          Body words
        </EmailView>
        <Letter heading="Letter heading" stamp="Stamp" footer="Footer words">
          Letter words
        </Letter>
        <Character name="Dana" mood="worried" />
        <StickyNote>Note words</StickyNote>
        <SpeechBubble speaker="Sam">Bubble words</SpeechBubble>
        <Router name="Router" lights={[{ label: 'Internet', state: 'amber' }]} />
        <Clock time="11:15" label="Now" />
        <Calendar month="Nov" day="24" weekday="Tuesday" note="Due 11:59 PM" />
      </Panel>,
    )
    for (const words of ['Caption words', 'https://example.test/page', 'Tab words', 'Page words', 'Wi-Fi: off', '10:58 PM', 'Toast body', 'Battery 21%', 'Phone words', 'Subject words', 'a@b.test', 'https://link.test', 'file.pdf', 'Letter heading', 'Stamp', 'Footer words', 'Dana', 'looks worried', 'Note words', 'Bubble words', 'Internet: amber', '11:15', 'Due 11:59 PM']) {
      expect(out).toContain(words)
    }
  })

  it('marks every drawing as decorative and uses no pictures from files', () => {
    const out = html(sampleEmailFrame.render())
    const svgs = out.match(/<svg\b[^>]*>/g) ?? []
    expect(svgs.length).toBeGreaterThan(0)
    for (const tag of svgs) expect(tag).toContain('aria-hidden="true"')
    expect(out).not.toMatch(/<img\b/)
  })

  it('writes the light state beside its shape so colour is never alone', () => {
    const out = html(<Router name="R" lights={[{ label: 'WPS', state: 'blinking' }, { label: 'Wi-Fi', state: 'off' }]} />)
    expect(out).toContain('WPS: blinking')
    expect(out).toContain('Wi-Fi: off')
  })

  it('sample frame names the sender address and where the link leads', () => {
    const out = html(sampleEmailFrame.render())
    expect(out).toContain('support@harlowfinch.exa')
    expect(out).toContain('Link goes to')
    expect(out).toContain('https://harlowfinch.exa/password')
  })

  it('draws the inbox list, log table, console card and tile with every word as text', () => {
    const out = html(
      <Scene description="Scene words">
        <InboxList
          title="Mail list"
          rows={[
            { time: '9:05 AM', from: 'Sender One', subject: 'Subject One', unread: true },
            { time: 'Tue', from: 'Sender Two', subject: 'Subject Two' },
          ]}
        />
        <LogTable title="Log title" columns={['Time', 'City']} rows={[['9:19 AM', 'Newark']]} />
        <ConsoleCard title="Card title" rows={[{ label: 'Domain', value: 'one.test' }]} />
        <StatTile>Tile words</StatTile>
      </Scene>,
    )
    for (const words of ['Scene words', 'Mail list', '9:05 AM', 'Sender One', 'Subject One', '(unread)', 'Sender Two', 'Subject Two', 'Log title', 'Time', 'City', '9:19 AM', 'Newark', 'Card title', 'Domain', 'one.test', 'Tile words']) {
      expect(out).toContain(words)
    }
    expect(out).toContain('<table')
    expect(out).toContain('<dl')
    expect(out).toMatch(/<p class="sr-only">Scene words<\/p>/)
    // The drawing repeats the description's words, so screen readers skip it.
    expect(out).toMatch(/<p class="sr-only">Scene words<\/p><div aria-hidden="true">/)
  })

  it('draws thought bubbles apart from speech, with the thinker named first', () => {
    const items: [string, string][] = [
      ['Lena', 'First thought words'],
      ['Tom', "Second thought's words"],
    ]
    const out = html(<Thoughts items={items} />)
    expect(out).toContain('Lena thinks')
    expect(out).toContain('Tom thinks')
    expect(out).toContain('First thought words')
    expect(out).toContain('dashed')
    expect(out).toContain('italic')
    for (const tag of out.match(/<svg\b[^>]*>/g) ?? []) expect(tag).toContain('aria-hidden="true"')
    expect(out.indexOf('Lena thinks')).toBeLessThan(out.indexOf('First thought words'))
    expect(thoughtWords(items)).toBe(`Lena thinks: "First thought words" Tom thinks: "Second thought's words"`)
  })

  it('reads a clock time that has AM or PM after it', () => {
    const out = html(<Clock time="10:58 PM" />)
    expect(out).toContain('10:58 PM')
    expect(out).not.toContain('NaN')
  })

  it('draws a list of lists one row per item and logs no warning', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const out = html(
      <ul>
        <Each items={[['a1', 'a2'], ['b1']]} render={(row) => <li>{row.join('+')}</li>} />
      </ul>,
    )
    expect(out).toBe('<ul><li>a1+a2</li><li>b1</li></ul>')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
