import { useState, useRef, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { useUpProvider } from '../contexts/UpProvider'
import ABI from '../abi/test.json'
import Frame from './../assets/frame.png'
import Traits from './../assets/traits.svg'
import IconPng from './../assets/icon-png.svg'
import DefaultPFP from './../assets/defaultPFP.png'
import Logo from '/logo.svg'
import Web3 from 'web3'
import styles from './Home.module.scss'
import { useNavigate } from 'react-router'

function Home() {
  const [totalSupply, setTotalSupply] = useState(0)
  const [profile, setProfile] = useState()
  const [collection, setCollection] = useState()
  const [token, setToken] = useState()

  const [freeMintCount, setFreeMintCount] = useState(0)

  const canvasRef = useRef()
  const asideRef = useRef()
  const coverRef = useRef()
  const fileRef = useRef()
  const navigate = useNavigate()

  const auth = useUpProvider()

  const web3Readonly = new Web3(import.meta.env.VITE_LUKSO_PROVIDER)
  const _ = web3Readonly.utils
  const contractReadonly = new web3Readonly.eth.Contract(ABI, import.meta.env.VITE_CONTRACT)

  const download = (url) => {
    //const htmlStr = SVG.current.outerHTML
    // const blob = new Blob([htmlStr], { type: 'image/svg+xml' })
    // const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    //  return
    //   const a = document.createElement('a')
    // a.setAttribute('download')

    //   a.setAttribute('href', url)
    //   a.style.display = 'none'
    //   document.body.appendChild(a)
    //   a.click()
    //   a.remove()
    // URL.revokeObjectURL(url)
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const rAsset = async (cid) => {
    const assetBuffer = await fetch(`${cid}`, {
      mode: 'cors',
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }).then(async (response) => {
      return response.arrayBuffer().then((buffer) => new Uint8Array(buffer))
    })

    return assetBuffer
  }

  const upload = async () => {
    const htmlStr = document.querySelector(`.${styles['board']} svg`).outerHTML
    const blob = new Blob([htmlStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    try {
      const t = toast.loading(`Uploading`)
      const file = new File([blob], 'test.svg', { type: blob.type })
      const upload = await pinata.upload.file(file)
      // console.log(upload)
      toast.dismiss(t)
      return [upload.IpfsHash, url]
    } catch (error) {
      console.log(error)
    }
  }

  const getTotalSupply = async () => await contractReadonly.methods.totalSupply().call()
  const getSwipePool = async (tokenId) => await contractReadonly.methods.swipePool(tokenId).call()

  const fetchData = async (dataURL) => {
    let requestOptions = {
      method: 'GET',
      redirect: 'follow',
    }
    const response = await fetch(`${dataURL}`, requestOptions)
    if (!response.ok) throw new Response('Failed to get data', { status: 500 })
    return response.json()
  }

  const getDataForTokenId = async (tokenId) => await contractReadonly.methods.getDataForTokenId(`${tokenId}`, '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e').call()

  const handleTokenDetail = async (tokenId) => {
    setSwipeModal(false)
    setTokenDetailModal(true)

    // Read connect wallet profile
    if (auth.walletConnected) {
      handleSearchProfile(auth.accounts[0]).then((profile) => {
        // console.log(profile)
        setProfile(profile)
      })

      // Read how many swipes left
      getSwipePool(tokenId, auth.accounts[0]).then((res) => {
        // console.log(res)
        setSwipeCount(_.toNumber(res))
      })
    }

    getDataForTokenId(tokenId).then((data) => {
      data = _.hexToUtf8(data)
      data = data.search(`data:application/json;`) > -1 ? data.slice(data.search(`data:application/json;`), data.length) : `${import.meta.env.VITE_IPFS_GATEWAY}` + data.slice(data.search(`ipfs://`), data.length).replace(`ipfs://`, '')

      fetchData(data).then((dataContent) => {
        // console.log(dataContent)
        dataContent.tokenId = tokenId
        console.log(dataContent)
        setTokenDetail(dataContent)

        // add the image to canvas
        var can = document.getElementById('canvas')
        var ctx = can.getContext('2d')

        var img = new Image()
        img.onload = function () {
          ctx.drawImage(img, 0, 0, can.width, can.height)
        }
        img.crossOrigin = `anonymous`
        img.src = `${import.meta.env.VITE_IPFS_GATEWAY}${dataContent.LSP4Metadata.images[0][0].url.replace('ipfs://', '').replace('://', '')}`
      })
    })
  }

  const downloadCanvas = function () {
    const link = document.createElement('a')
    link.download = `Thunder.png`
    link.href = canvasRef.current.toDataURL()
    link.click()
    link.remove()
  }

  const getAllCollection = async (addr) => {
    var myHeaders = new Headers()
    myHeaders.append('Content-Type', `application/json`)
    myHeaders.append('Accept', `application/json`)

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({
        query: `query MyQuery {
    search_profiles(args: {search: "${addr}"}) {
    id
    lsp5ReceivedAssets(where: {asset: {isLSP7: {_eq: false}}}) {
      id
      asset_id
      asset {
        id
        isCollection
        isLSP7
        name
        lsp4TokenName
        lsp4TokenSymbol
        lsp4TokenType
        src
        tokens {
          id
          asset_id
          baseAsset_id
          name
          tokenId
          src
          holders {
            profile {
              fullName
              id
            }
          }
        }
        images {
          src
        }
      }
    }
  }
}`,
      }),
    }
    const response = await fetch(`${import.meta.env.VITE_PUBLIC_API_ENDPOINT}`, requestOptions)
    if (!response.ok) {
      throw new Response('Failed to ', { status: 500 })
    }
    const data = await response.json()
    return data
  }
  const getAllTokens = async (collection) => {
    var myHeaders = new Headers()
    myHeaders.append('Content-Type', `application/json`)
    myHeaders.append('Accept', `application/json`)

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({
        query: `query MyQuery {
  Asset(where: {id: {_eq: "${collection}"}}) {
    id
    lsp4TokenName
    lsp4TokenSymbol
    isCollection
    tokens {
      baseAsset_id
      images {
        src
        token {
          tokenId
        }
      }
      holders {
        profile_id
      }
    }
    owner_id
  }
}`,
      }),
    }
    const response = await fetch(`${import.meta.env.VITE_PUBLIC_API_ENDPOINT}`, requestOptions)
    if (!response.ok) {
      throw new Response('Failed to ', { status: 500 })
    }
    const data = await response.json()
    return data
  }

  const getTokenInfo = async (collection, tokenId) => {
    var myHeaders = new Headers()
    myHeaders.append('Content-Type', `application/json`)
    myHeaders.append('Accept', `application/json`)

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({
        query: `query MyQuery {
  Asset(where: {id: {_eq: "${collection}"}}) {
    id
    lsp4TokenName
    lsp4TokenSymbol
    isCollection
    tokens(
      where: {tokenId: {_eq: "${tokenId}"}}
    ) {
      baseAsset_id
      images {
        src
        token {
          tokenId
        }
      }
    }
  }
}`,
      }),
    }
    const response = await fetch(`${import.meta.env.VITE_PUBLIC_API_ENDPOINT}`, requestOptions)
    if (!response.ok) {
      throw new Response('Failed to ', { status: 500 })
    }
    const data = await response.json()
    return data
  }

  const showTokens = async (collection) => {
    const t = toast.loading(`Reading tokens`)
    setToken('')

    getAllTokens(collection).then((res) => {
      console.log(res.data.Asset[0].tokens.filter((item) => item.holders[0].profile_id == auth.accounts[0]))
      setToken(res.data.Asset[0].tokens.filter((item) => item.holders[0].profile_id == auth.accounts[0]))
      toast.dismiss(t)
    })
  }
  function roundedImage(ctx, x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }
  const addToCanvas = async (path, tokenId) => {
    const t = toast.loading(`Loading image`)
    // add the image to canvas
    const can = canvasRef.current
    const ctx = can.getContext('2d')

    // Reset canvas
    ctx.clearRect(0, 0, can.width, can.height)

    await addBanner()

    const img = new Image()
    img.onload = function () {
      toast.dismiss(t)

      ctx.save()
      roundedImage(ctx, 464, 100, 303, 303, 10)
      ctx.strokeStyle = '#000'
      ctx.stroke()
      ctx.clip()
      ctx.drawImage(img, 464, 100, 303, 303)
      ctx.restore()

      addName()

      addTokenId(tokenId)
      addTokenId(tokenId)
    }
    img.crossOrigin = `anonymous`
    img.src = path
  }

  const addTokenId = async (tokenId) => {
    const can = canvasRef.current
    const ctx = can.getContext('2d')
        ctx.fillStyle = 'orange'
    ctx.font = 'bold 16px Arial'
    // Add token id
    ctx.fillText(`#${_.toNumber(tokenId)}`, 790, 90, 200)
    ctx.shadowColor = 'orange'
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
    ctx.shadowBlur = 8
  }

  const chooseLocalFile = (e) => {
    fileRef.current.click()
  }

  const hideAside = () => {
    console.log(`hide`)
    asideRef.current.classList.add(`${styles['hide']}`)
    coverRef.current.classList.add(`animate__fadeOut`)
  }

  const showAside = () => {
    const t = toast.loading(`Reading NFTs`,{icon: `🐲`})
    setCollection('')
    setToken('')

    getAllTokens(import.meta.env.VITE_CONTRACT).then((res) => {
      console.log(res)
      setToken(res.data.Asset[0].tokens.filter((item) => item.holders[0].profile_id == auth.accounts[0]))
      toast.dismiss(t)
    })

    asideRef.current.classList.remove(`${styles['hide']}`)
    coverRef.current.classList.add(`animate__fadeOut`)
  }

  const addName = async () => {
    handleSearchProfile(auth.accounts[0]).then((profile) => {
      const can = canvasRef.current
      const ctx = can.getContext('2d')
      ctx.fillStyle = 'orange'
      ctx.font = 'bold 16px Arial'
      ctx.fillText(profile.data.search_profiles[0].fullName.toUpperCase(), 468, 88, 300)
      ctx.shadowColor = 'orange'
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2
      ctx.shadowBlur = 8
    })
  }

  const addBanner = async () => {
    // add the image to canvas
    const can = canvasRef.current
    const ctx = can.getContext('2d')

    const img = new Image()
    img.onload = function () {
      ctx.drawImage(img, 0, 0, 1500, 500)
    }
    img.crossOrigin = `anonymous`
    img.src = Frame
  }
  const handleSearchProfile = async (addr) => {
    var myHeaders = new Headers()
    myHeaders.append('Content-Type', `application/json`)
    myHeaders.append('Accept', `application/json`)

    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({
        query: `query MyQuery {
  search_profiles(
    args: {search: "${addr}"}
    limit: 1
  ) {
    fullName
    id
    profileImages {
      src
    }
  }
}`,
      }),
    }
    const response = await fetch(`${import.meta.env.VITE_PUBLIC_API_ENDPOINT}`, requestOptions)
    if (!response.ok) {
      throw new Response('Failed to ', { status: 500 })
    }
    const data = await response.json()
    setProfile(data)
    return data
  }

  useEffect(() => {
    console.clear()
    addBanner()
  }, [])

  return (
    <>
      <div className={`${styles.page}`}>
        <Toaster />

        <aside ref={asideRef} className={`${styles.aside} ${styles.hide}`}>
          <div ref={coverRef} className={`animate__animated ${styles.aside__cover}`} onClick={(e) => hideAside()}></div>
          <div className={styles.aside__wrapper}>
            <div className={`grid grid--fit grid--gap-1 ${styles['token']}`} style={{ '--data-width': `60px` }}>
              {token && (
                <>
                  <button
                    className="btn"
                    onClick={() => {
                      setToken('')
                      hideAside()
                    }}
                  >
                    Back
                  </button>
                  {token.map((item, i) => {
                    console.log(item)
                    return (
                      <figure key={i}>
                        <img src={item.images[0].src} onClick={() => addToCanvas(item.images[0].src, item.images[0].token.tokenId)} title={item.tokenId} />
                      </figure>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        </aside>

        <main className={`${styles.main} d-f-c flex-column w-100`}>
          {/* <button
            onClick={() =>
              addToCanvas(
                `https://api.universalprofile.cloud/image/bafybeifkvtmwqzjfpqjkd5jetjh7u7b6ixs36fwjvydne3s6sceduwn3g4?method=keccak256(bytes)&data=0xb6641e9cead9ce820a9fb1c3fa71fdfd4a45db431e1190b90fac71414dadb263&width=260&dpr=1.25`,
                `0x0000000000000000000000000000000000000000000000000000000000000001`
              )
            }
          >
            add
          </button> */}
          <header className={`${styles.header} d-flex align-items-center justify-content-between w-100`}>
            <figure className={`d-f-c grid--gap-1`}>
              <img alt={`${import.meta.env.VITE_NAME} Logo`} src={Logo} />
              <figcaption className={`d-flex flex-column align-items-center justify-content-start`}>
                <h2 className={`w-100`}>{import.meta.env.VITE_NAME}</h2>
                <small>Dracos Banner Generator</small>
              </figcaption>
            </figure>

            {auth.walletConnected ? (
              <ShowPFP account={auth.accounts[0]} />
            ) : (
              <figure className={`d-f-c flex-column`}>
                <img src={`${DefaultPFP}`} className={`rounded ms-depth-8`} style={{ height: `48px` }} alt={`PFP`} />
              </figure>
            )}
          </header>

          <div className={`${styles.info} d-flex w-100 mt-40 grid--gap-1`}>
            <div className={`card`} data-shadow={`none`}>
              <div className={`card__body`}>
                <figure>
                  <img alt={`PNG`} src={IconPng} style={{ width: `32px` }} />
                </figure>
              </div>
            </div>

            <div className={`card`} data-shadow={`none`}>
              <div className={`card__body d-f-c grid--gap-025`}>
                <span className={`badge badge-dark`}>1500px</span>
                <span className={`badge`} style={{ border: `none` }}>
                  500px
                </span>
              </div>
            </div>
          </div>

          <div className={`d-flex w-100 grid--gap-1`}>
            <canvas ref={canvasRef} id={`canvas`} width={1500} height={500} className={`ms-depth-16`}></canvas>

            <figure>
              <img src={Traits} className={`${styles.hero}`} style={{ width: `100%` }} />
            </figure>
          </div>
        </main>

        <footer className={`${styles.footer} d-flex flex-column align-items-center justify-content-between`}>
          <div className={`w-100 d-flex align-items-center justify-content-center grid--gap-050`}>
            <button className={`${styles['download']}`} onClick={() => showAside()} disabled={!auth.walletConnected}>
              Choose NFT
            </button>
            <button className={`${styles['download']}`} onClick={() => downloadCanvas()}>
              Download
            </button>
          </div>
          <button
            className={`${styles['share']}`}
            onClick={() =>
              window.open(
                `https://x.com/share?text=${encodeURIComponent(`Just upgraded my @DracosKodo PFP with a custom 1 of 1 banner using the Thunder Mini-App on @lukso_io ! ⚡🐲

It auto-populated my handle & Dracos token id seamlessly into a PNG that's optimized for $LYX Universal Profiles & X/Twitter 🆙

Create yours now → `)}&url=https://t.co/e0KwH16hWV`
              )
            }
          >
            Share
          </button>
        </footer>
      </div>
    </>
  )
}

const ShowPFP = ({ account }) => {
  const [profile, setProfile] = useState()

  const handleSearchProfile = async (addr) => {
    var myHeaders = new Headers()
    myHeaders.append('Content-Type', `application/json`)
    myHeaders.append('Accept', `application/json`)

    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({
        query: `query MyQuery {
  search_profiles(
    args: {search: "${addr}"}
    limit: 1
  ) {
    fullName
    id
    profileImages {
      src
    }
  }
}`,
      }),
    }
    const response = await fetch(`${import.meta.env.VITE_PUBLIC_API_ENDPOINT}`, requestOptions)
    if (!response.ok) {
      throw new Response('Failed to ', { status: 500 })
    }
    const data = await response.json()
    setProfile(data)
    return data
  }

  useEffect(() => {
    handleSearchProfile(account).then((profile) => {
      console.log(profile)
      setProfile(profile)

      // const can = document.querySelector(`canvas`)
      // const ctx = can.getContext('2d')
      // ctx.fillStyle = 'orange'
      // ctx.font = 'bold 16px Arial'
      // ctx.fillText(profile.data.search_profiles[0].fullName.toUpperCase(), 468, 88, 300)
      // ctx.shadowColor = 'orange'
      // ctx.shadowOffsetX = 2
      // ctx.shadowOffsetY = 2
      // ctx.shadowBlur = 8
    })
  }, [])

  return (
    <figure className={`d-f-c flex-column`}>
      {!profile && <img src={DefaultPFP} className={`rounded ms-depth-8`} style={{ height: `48px` }} alt={``} />}
      {profile && <img src={profile.data.search_profiles[0].profileImages[0].src} className={`rounded ms-depth-8`} style={{ height: `48px` }} alt={``} />}
    </figure>
  )
}

export default Home
